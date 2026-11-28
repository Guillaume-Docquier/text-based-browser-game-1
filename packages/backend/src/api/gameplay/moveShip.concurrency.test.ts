import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { and, eq, sql } from "drizzle-orm"
import { creditDigits } from "shared/domain/games/credits.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { describe, it, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { moveOrdersTable, planetsTable, playersTable, starsTable, turnsTable } from "#lib/db/schema.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { ConstructionErrorResponses } from "./construction.error.ts"

describe("movement and construction share a budget", () => {
  it.each([
    { balance: "30.1", expectedError: null, expected: "10" },
    {
      balance: "30.09999999999999998",
      expectedError: expect.objectContaining({
        message: ConstructionErrorResponses.INSUFFICIENT_CREDITS.message,
        data: expect.objectContaining({ code: "CONFLICT" }),
      }),
      expected: "39.99999999999999998",
    },
  ])("should preserve an exact $balance budget under competing reservations", async ({ balance, expectedError, expected }) => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, concurrency } = postgres
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const alice = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
    })
    await alice.client.games.startGame.mutate({ gameId })
    const view = await alice.client.gameplay.getPlayerView.query({ gameId })
    const [ship] = view.ships
    const [system] = view.galaxy.systems
    Assert.isDefined(ship)
    Assert.isDefined(system)
    Assert.isDefined(ship.planetId)
    await db
      .update(planetsTable)
      .set({ x: 0, y: 0 })
      .where(and(eq(planetsTable.gameId, gameId), eq(planetsTable.id, ship.planetId)))
    await db
      .update(starsTable)
      .set({ x: 0.1, y: 0 })
      .where(and(eq(starsTable.gameId, gameId), eq(starsTable.id, system.star.id)))
    await db
      .update(playersTable)
      .set({ creditBalance: sql`${balance}::numeric` })
      .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, view.player.id)))
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })

    // Act
    await using insertBlock = await concurrency.blockWrites(moveOrdersTable)
    const move = Result.tryCatch(
      alice.client.gameplay.moveShip.mutate({
        action: "submit",
        gameId,
        turn: 1,
        shipId: ship.id,
        destination: { kind: "star", id: system.star.id },
      }),
    )
    const writer = await concurrency.waitForBlockedQuery({
      blockedBy: insertBlock.pid,
      command: "insert",
      table: moveOrdersTable,
      lock: "table",
    })
    const build = alice.client.gameplay.construction
      .mutate({
        action: "submit",
        gameId,
        turn: 1,
        planetId: ship.planetId,
        type: BuildingType.TRADE_CENTER,
        site: 2,
      })
      .then(
        () => null,
        (error: unknown) => error,
      )
    await concurrency.waitForBlockedQuery({ blockedBy: writer, command: "select", table: turnsTable, lock: "row" })
    await insertBlock.release()

    // Assert
    expect(Result.isSuccess(await move)).toBe(true)
    expect(await build).toStrictEqual(expectedError)
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const settled = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(creditDigits(settled.player.creditBalanceExact)).toBe(expected)
    expect(settled.ships[0]).toMatchObject({ starId: system.star.id, order: null, trip: null })
  })
})
