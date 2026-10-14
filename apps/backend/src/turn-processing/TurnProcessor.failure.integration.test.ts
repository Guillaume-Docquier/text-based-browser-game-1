import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { getActionToSubmintegrationTest, FailingTurnsRepository } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"

describe("TurnProcessor", () => {
  describe("processNextDueTurn", () => {
    integrationTest("should not do anything in case of failure", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(playerView, GainInfluence.id),
      })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId: createdGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })
      const turnToProcess = { gameId: createdGameId, turn: 1 }

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const failedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterFailedSave = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      turnsRepository.shouldFail = false
      await turnsRepository.resetProcessingAttempt(turnToProcess)
      const retriedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterRetry = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(failedProcessingResult).toBe("failed")
      expect(playerViewAfterFailedSave).toMatchObject({
        turn: 1,
        resources: {
          [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
        },
      })
      expect(retriedProcessingResult).toBe("processed")
      expect(playerViewAfterRetry).toMatchObject({
        turn: 2,
        resources: {
          [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 },
        },
      })
    })
  })
})
