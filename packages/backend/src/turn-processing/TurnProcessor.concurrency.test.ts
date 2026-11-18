import { Assert, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { resourcesTable, turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { concurrencyTest } from "#tests/vitest.concurrency.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("TurnProcessor concurrency", () => {
  concurrencyTest("should skip a claimed turn and process a different due turn", async ({ postgres: { db, concurrency } }) => {
    // Arrange
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))

    const player = await server.createClient({ authenticated: true })
    const earlierGameId = await createGameWithSubmittedAction(player, 50)
    const laterGameId = await createGameWithSubmittedAction(player, 100)

    const firstProcessor = await createTurnProcessorStub({ db, clock })
    const secondProcessor = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(100, UnitOfTime.SECONDS) })

    await firstProcessor.turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using block = await concurrency.blockWrites(turnsTable)

    // Act
    const firstTurnProcessing = Result.tryCatch(firstProcessor.turnProcessor.processNextDueTurn())
    const firstPid = await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "update", table: turnsTable, lock: "table" })

    const secondTurnProcessing = Result.tryCatch(secondProcessor.turnProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({
      blockedBy: block.pid,
      command: "update",
      table: turnsTable,
      lock: "table",
      excludingPid: firstPid,
    })

    await block.release()

    // Assert
    expect(await firstTurnProcessing).toStrictEqual(Result.Success("processed"))
    expect(await secondTurnProcessing).toStrictEqual(Result.Success("processed"))

    const turn2 = {
      turn: 2,
      turnStatus: "COLLECTING_ACTIONS",
      resources: { [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 } },
    }
    expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject(turn2)
    expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject(turn2)

    expect(await firstProcessor.turnProcessor.processNextDueTurn()).toBe("idle")
  })

  concurrencyTest("should return idle while the only due turn is claimed", async ({ postgres: { db, concurrency } }) => {
    // Arrange
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))

    const player = await server.createClient({ authenticated: true })
    const gameId = await createGameWithSubmittedAction(player, 50)

    const firstProcessor = await createTurnProcessorStub({ db, clock })
    const secondProcessor = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(50, UnitOfTime.SECONDS) })

    await firstProcessor.turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using block = await concurrency.blockWrites(turnsTable)

    // Act & Assert
    const firstTurnProcessing = Result.tryCatch(firstProcessor.turnProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "update", table: turnsTable, lock: "table" })

    const secondTurnProcessing = await concurrency.waitForCompletion(secondProcessor.turnProcessor.processNextDueTurn())
    expect(secondTurnProcessing).toBe("idle")
    await block.release()

    expect(await firstTurnProcessing).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: "COLLECTING_ACTIONS",
      resources: { [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 } },
    })
    expect(await secondProcessor.turnProcessor.processNextDueTurn()).toBe("idle")
  })

  concurrencyTest("should skip a claimed turn while it is saving its result", async ({ postgres: { db, concurrency } }) => {
    // Arrange
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))

    const player = await server.createClient({ authenticated: true })
    const gameId = await createGameWithSubmittedAction(player, 50)

    const firstProcessor = await createTurnProcessorStub({ db, clock })
    const secondProcessor = await createTurnProcessorStub({ db, clock })

    clock.increment({ time: Time.create(50, UnitOfTime.SECONDS) })

    await firstProcessor.turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
    await using block = await concurrency.blockWrites(resourcesTable)

    // Act & Assert
    const firstTurnProcessing = Result.tryCatch(firstProcessor.turnProcessor.processNextDueTurn())
    await concurrency.waitForBlockedQuery({ blockedBy: block.pid, command: "insert", table: resourcesTable, lock: "table" })
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 1,
      turnStatus: "PROCESSING",
      resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
    })

    expect(await concurrency.waitForCompletion(secondProcessor.turnProcessor.processNextDueTurn())).toBe("idle")
    await block.release()

    expect(await firstTurnProcessing).toStrictEqual(Result.Success("processed"))
    expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: "COLLECTING_ACTIONS",
      resources: { [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 } },
    })

    expect(await secondProcessor.turnProcessor.processNextDueTurn()).toBe("idle")
  })
})

async function createGameWithSubmittedAction(player: AuthenticatedApiClient, turnIntervalSeconds: number): Promise<GameId> {
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({ turnIntervalSeconds, mapGenerationSeed: 1234 }),
  })
  await player.client.games.startGame.mutate({ gameId })

  const view = await player.client.gameplay.getPlayerView.query({ gameId })
  const gainInfluence = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
  Assert.isDefined(gainInfluence)

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: 1,
    submittedActionTargets: { actionId: gainInfluence.id, selectedTargets: {} },
  })

  return gameId
}
