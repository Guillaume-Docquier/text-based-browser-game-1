import { Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { sql } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { playersTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#testing/ApiClient.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createConcurrencyTestDb } from "#testing/createConcurrencyTestDb.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("TurnProcessor concurrency", () => {
  it("should process a later due turn while another worker claims the earlier turn", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, concurrency } = postgres
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const player = await server.createClient({ authenticated: true })
    const earlierGameId = await startGame(player, 50)
    const laterGameId = await startGame(player, 100)
    const { turnProcessor: firstProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { turnProcessor: secondProcessor } = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(100, UnitOfTime.SECONDS) })
    await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })

    await using claimBlock = await concurrency.blockRowWrites(
      turnsTable,
      sql`${turnsTable.gameId} = ${earlierGameId} AND ${turnsTable.turn} = 1`,
    )

    // Act & Assert
    const firstOutcome = Result.tryCatch(firstProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: claimBlock.pid, command: "update", table: turnsTable, lock: "row" })

    expect(await concurrency.waitForCompletion(secondProcessor.processNextDueTurn())).toBe("processed")
    expect(await player.client.gameplay.turnState.query({ gameId: laterGameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
    })

    await claimBlock.release()
    expect(await firstOutcome).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.turnState.query({ gameId: earlierGameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
    })
  })

  it("should return idle while another worker claims the only due turn", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, concurrency } = postgres
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const player = await server.createClient({ authenticated: true })
    const gameId = await startGame(player, 50)
    const { turnProcessor: firstProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { turnProcessor: secondProcessor } = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(50, UnitOfTime.SECONDS) })
    await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using claimBlock = await concurrency.blockWrites(turnsTable)

    // Act & Assert
    const firstOutcome = Result.tryCatch(firstProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: claimBlock.pid, command: "update", table: turnsTable, lock: "table" })

    expect(await concurrency.waitForCompletion(secondProcessor.processNextDueTurn())).toBe("idle")

    await claimBlock.release()
    expect(await firstOutcome).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.turnState.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
    })
  })

  it("should return idle while another worker saves the only due turn", async () => {
    // Arrange
    await using postgres = await createConcurrencyTestDb()
    const { db, concurrency } = postgres
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const player = await server.createClient({ authenticated: true })
    const gameId = await startGame(player, 50)
    const { turnProcessor: firstProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { turnProcessor: secondProcessor } = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(50, UnitOfTime.SECONDS) })
    await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using saveBlock = await concurrency.blockWrites(playersTable)

    // Act & Assert
    const firstOutcome = Result.tryCatch(firstProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: saveBlock.pid, command: "update", table: playersTable, lock: "table" })
    expect(await player.client.gameplay.turnState.query({ gameId })).toMatchObject({
      turn: 1,
      turnStatus: TurnStatus.PROCESSING,
    })
    expect(await concurrency.waitForCompletion(secondProcessor.processNextDueTurn())).toBe("idle")

    await saveBlock.release()
    expect(await firstOutcome).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.turnState.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
    })
  })
})

async function startGame(creator: AuthenticatedApiClient, turnIntervalSeconds: number): Promise<GameId> {
  const { createdGameId: gameId } = await creator.client.games.create.mutate({
    configuration: createGameConfigurationStub({ turnIntervalSeconds, mapGenerationSeed: 1234 }),
  })
  await creator.client.games.startGame.mutate({ gameId })
  return gameId
}
