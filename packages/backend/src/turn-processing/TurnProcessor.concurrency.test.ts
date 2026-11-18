import { Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { sql } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { resourcesTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("TurnProcessor concurrency", () => {
  concurrencyTest(
    "should process a later due turn while another worker claims the earlier turn",
    async ({ postgres: { db, concurrency } }) => {
      // Arrange
      const clock = new ControlledClock()
      using server = new ApiServer(await createApiStub({ db, clock }))
      const player = await server.createClient({ authenticated: true })
      const earlierGameId = await startGame(player, 50)
      const laterGameId = await startGame(player, 100)
      const { turnProcessor: firstProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const { turnProcessor: secondProcessor } = await createTurnProcessorStub({ db, clock })

      clock.increment({ time: Time.create(100, UnitOfTime.SECONDS) })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })

      // Pause the first worker's status update after it locks the queue entry for the earlier turn.
      await using claimBlock = await concurrency.blockRowWrites(
        turnsTable,
        sql`${turnsTable.gameId} = ${earlierGameId} AND ${turnsTable.turn} = 1`,
      )

      // Act & Assert
      const firstOutcome = Result.tryCatch(firstProcessor.processNextDueTurn())
      await concurrency.waitForBlockedQuery({ blockedBy: claimBlock.pid, command: "update", table: turnsTable, lock: "row" })

      expect(await concurrency.waitForCompletion(secondProcessor.processNextDueTurn())).toBe("processed")
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 2,
        turnStatus: TurnStatus.COLLECTING_ACTIONS,
      })

      await claimBlock.release()
      expect(await firstOutcome).toStrictEqual(Result.Success("processed"))
      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        turnStatus: TurnStatus.COLLECTING_ACTIONS,
      })
    },
  )

  concurrencyTest("should return idle while another worker claims the only due turn", async ({ postgres: { db, concurrency } }) => {
    // Arrange
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
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
    })
  })

  concurrencyTest("should return idle while another worker saves the only due turn", async ({ postgres: { db, concurrency } }) => {
    // Arrange
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const player = await server.createClient({ authenticated: true })
    const gameId = await startGame(player, 50)
    const { turnProcessor: firstProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const { turnProcessor: secondProcessor } = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(50, UnitOfTime.SECONDS) })
    await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using saveBlock = await concurrency.blockWrites(resourcesTable)

    // Act & Assert
    const firstOutcome = Result.tryCatch(firstProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: saveBlock.pid, command: "insert", table: resourcesTable, lock: "table" })
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 1,
      turnStatus: TurnStatus.PROCESSING,
    })
    expect(await concurrency.waitForCompletion(secondProcessor.processNextDueTurn())).toBe("idle")

    await saveBlock.release()
    expect(await firstOutcome).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
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
