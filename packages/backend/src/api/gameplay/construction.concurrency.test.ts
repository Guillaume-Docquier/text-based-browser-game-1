import { Assert, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { and, eq, sql } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { buildingsTable, constructionOrdersTable, planetsTable, playersTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#testing/ApiClient.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { ConstructionCommand } from "./construction.command.ts"
import { ConstructionErrorResponses } from "./construction.error.ts"

describe("construction reservations", () => {
  it.each(["submit", "cancel"] as const)("should reject a waiting %s after the deadline under the turn lock", async (action) => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, concurrency } = postgres
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const alice = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({ mapGenerationSeed: 1234, turnIntervalSeconds: 60 }),
    })
    await alice.client.games.startGame.mutate({ gameId })
    const view = await alice.client.gameplay.getPlayerView.query({ gameId })
    const home = view.galaxy.systems.flatMap((s) => s.planets).find((p) => p.ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    const submit = { action: "submit" as const, gameId, turn: 1, planetId: home.id, type: BuildingType.TRADE_CENTER, site: 2 }
    const command = await prepareCutoffCommand(action, alice, submit)
    const before = await alice.client.gameplay.getPlayerView.query({ gameId })

    // Act
    await using block = await concurrency.blockRowWrites(turnsTable, sql`${turnsTable.gameId} = ${gameId} AND ${turnsTable.turn} = 1`)
    const waiting = Result.tryCatch(alice.client.gameplay.construction.mutate(command))
    await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "select", table: turnsTable, lock: "row" })
    clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
    await block.release()
    // Assert
    const outcome = await waiting
    Assert.isTrue(Result.isFailure(outcome))
    expect(outcome.error).toMatchObject({ message: ConstructionErrorResponses.TURN_NOT_OPEN.message, data: { code: "CONFLICT" } })
    expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(before)
  })

  it("should meet CON-0002 When a paid order would exceed a player’s available turn-start credits after other reservations, reject it without altering their existing plans.", async () => {
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
    const planets = view.galaxy.systems.flatMap((system) => system.planets)
    const home = planets.find((planet) => planet.ownerPlayerId === view.player.id)
    const colony = planets.filter((planet) => Number(planet.area) >= 3).find((planet) => planet.ownerPlayerId === null)
    Assert.isDefined(home)
    Assert.isDefined(colony)
    await db
      .update(playersTable)
      .set({ creditBalance: 50 })
      .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, view.player.id)))
    await db
      .update(planetsTable)
      .set({ ownerPlayerId: view.player.id })
      .where(and(eq(planetsTable.gameId, gameId), eq(planetsTable.id, colony.id)))
    await db.insert(buildingsTable).values({ gameId, planetId: colony.id, site: 0, type: BuildingType.COMMAND_CENTER })
    const first = { action: "submit" as const, gameId, turn: 1, type: BuildingType.TRADE_CENTER, planetId: home.id, site: 2 }
    const second = { ...first, planetId: colony.id, site: 1 }
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })

    // Act
    await using insertBlock = await concurrency.blockWrites(constructionOrdersTable)
    const homeSubmission = Result.tryCatch(alice.client.gameplay.construction.mutate(first))
    const homeWriter = await concurrency.waitForBlockedQuery({
      blockedBy: insertBlock.pid,
      command: "insert",
      table: constructionOrdersTable,
      lock: "table",
    })
    const colonySubmission = Result.tryCatch(alice.client.gameplay.construction.mutate(second))
    await concurrency.waitForBlockedQuery({ blockedBy: homeWriter, command: "select", table: turnsTable, lock: "row" })
    await insertBlock.release()

    // Assert
    expect(Result.isSuccess(await homeSubmission)).toBe(true)
    const outcome = await colonySubmission
    Assert.isTrue(Result.isFailure(outcome))
    expect(outcome.error).toMatchObject({ message: ConstructionErrorResponses.INSUFFICIENT_CREDITS.message, data: { code: "CONFLICT" } })
    const reserved = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(reserved.player.creditBalance).toBe(50)
    expect(reserved.constructionOrders).toHaveLength(1)
    const [order] = reserved.constructionOrders
    Assert.isDefined(order)
    expect(order).toMatchObject({ planetId: home.id, site: 2, cost: 30 })

    await alice.client.gameplay.construction.mutate({ action: "cancel", gameId, turn: 1, orderId: order.id })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const funded = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(funded.player.creditBalance).toBe(60)
    await alice.client.gameplay.construction.mutate({ ...first, turn: 2 })
    await alice.client.gameplay.construction.mutate({ ...second, turn: 2 })
    const both = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(both.constructionOrders).toHaveLength(2)
    const homeOrder = both.constructionOrders.find((plan) => plan.planetId === home.id)
    Assert.isDefined(homeOrder)
    await alice.client.gameplay.construction.mutate({ action: "cancel", gameId, turn: 2, orderId: homeOrder.id })
    const remaining = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(remaining.constructionOrders).toStrictEqual(both.constructionOrders.filter((plan) => plan.planetId === colony.id))
    await alice.client.gameplay.construction.mutate({ ...first, turn: 2 })
    await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: 2, isReady: true })
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const settled = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(settled.player.creditBalance).toBe(10)
    expect(settled.constructionOrders).toStrictEqual([])
    expect(settled.buildings).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ planetId: home.id, site: 2, type: "TRADE_CENTER" }),
        expect.objectContaining({ planetId: colony.id, site: 1, type: "TRADE_CENTER" }),
      ]),
    )
  })
})

async function prepareCutoffCommand(
  action: "submit" | "cancel",
  player: AuthenticatedApiClient,
  submit: Extract<ConstructionCommand, { action: "submit" }>,
): Promise<ConstructionCommand> {
  if (action === "submit") {
    return submit
  }
  await player.client.gameplay.construction.mutate(submit)
  const [order] = (await player.client.gameplay.getPlayerView.query({ gameId: submit.gameId })).constructionOrders
  Assert.isDefined(order)
  return { action: "cancel", gameId: submit.gameId, turn: submit.turn, orderId: order.id }
}
