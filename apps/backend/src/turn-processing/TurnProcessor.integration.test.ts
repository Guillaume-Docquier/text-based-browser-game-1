import { Assert, branded, Datetime, type DeepUnbranded, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { createTestGameConfigurationStub } from "shared/testing/GameConfiguration.stub.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetImproved } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { afterEach, describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("TurnProcessor", () => {
  describe("processTurnsForever", () => {
    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    integrationTest("should process all currently due turns before waiting", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.games.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: secondGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      expect(await player.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should wait before retrying when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // No turns were processed because turns in error block, this will be resolved by https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/278
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })
  })

  describe("processNextDueTurn", () => {
    integrationTest("should process the current turn and queue the next one", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, GainInfluence.id),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const repeatedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        turn: 2,
        turnEndsAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        resources: createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 8, total: 8 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
        actions: expect.any(Array),
      })
      expect(playerView.actions.map(({ id }) => id)).toStrictEqual(initialPlayerView.actions.map(({ id }) => id))
      expect(playerView.actions.every(({ selectedTargets }) => selectedTargets === null)).toBe(true)
      expect(repeatedPlayerView.actions).toStrictEqual(playerView.actions)
    })

    integrationTest("should process multiple submitted actions", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      for (const actionDefinitionId of [GainFuel.id, GainMetal.id]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, actionDefinitionId),
        })
      }

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
        turn: 2,
        resources: createResourcesDtoStub({
          [ResourceType.METAL]: { uncommitted: 5, total: 5 },
          [ResourceType.FUEL]: { uncommitted: 6, total: 6 },
        }),
      })
    })

    integrationTest("should process actions that build fleets", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // Create the game
      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      // Start the game
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      const homePlanet = initialPlayerView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)

      // Build a fleet
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: { actionId: buildFleet.id, selectedTargets: { planet: homePlanet.id } },
      })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(initialPlayerView.fleets).toStrictEqual([])
      expect(playerView.fleets).toStrictEqual([
        {
          id: expect.any(String), // this is deterministic, but we cannot control the initial game rng state
          ownerPlayerId: player.account.id,
          name: expect.any(String), // this is deterministic, but we cannot control the initial game rng state
          strength: 10,
          originPlanetId: homePlanet.id,
        },
      ])
    })

    integrationTest("should persist a fleet in transit and land it after another turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(origin)
      // With seed 1234, this planet is about 1.146 light years from the home planet.
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(destination)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Earn enough resources to build a fleet and refine its fuel next turn.
      for (const actionDefinitionId of [GainInfluence.id, GainMetal.id]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(initialView, actionDefinitionId),
        })
      }
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const fundedView = await player.client.gameplay.getPlayerView.query({ gameId })

      for (const submittedActionTargets of [
        getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: origin.id }),
        getActionToSubmintegrationTest(fundedView, GainFuel.id),
        getActionToSubmintegrationTest(fundedView, GainInfluence.id),
      ]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fundedView.turn,
          submittedActionTargets,
        })
      }
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const fleet = builtView.fleets[0]
      Assert.isDefined(fleet)
      expect(builtView.fleets).toHaveLength(1)
      expect(fleet).toMatchObject({ ownerPlayerId: player.account.id, originPlanetId: origin.id, strength: 10 })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(builtView, MoveFleetImproved.id, {
          fleet: fleet.id,
          planet: destination.id,
        }),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const firstTurnResult = await turnProcessor.processNextDueTurn()
      const inTransitView = await player.client.gameplay.getPlayerView.query({ gameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: inTransitView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(inTransitView, MoveFleetImproved.id, {
          fleet: fleet.id,
          planet: destination.id,
        }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const secondTurnResult = await turnProcessor.processNextDueTurn()
      const landedView = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      expect(firstTurnResult).toBe("processed")
      expect(secondTurnResult).toBe("processed")
      expect(inTransitView.turn).toBe(4)
      expect(inTransitView.fleets).toStrictEqual([
        {
          ...fleet,
          destinationPlanetId: destination.id,
          distanceToEnd: expect.closeTo(0.1456435045942517, 12),
        },
      ])
      expect(landedView.turn).toBe(5)
      expect(landedView.fleets).toStrictEqual([
        {
          ...fleet,
          originPlanetId: destination.id,
        },
      ])
    })

    integrationTest("should merge an arriving fleet with the player's fleet at the destination in one turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const homePlanet = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)
      // This planet shares the home system, so an improved move takes one turn.
      const nearbyPlanet = planets.find(({ coordinates }) => coordinates === "45:98:25")
      Assert.isDefined(nearbyPlanet)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      for (const actionDefinitionId of [GainInfluence.id, GainMetal.id]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(initialView, actionDefinitionId),
        })
      }
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const fundedView = await player.client.gameplay.getPlayerView.query({ gameId })

      for (const submittedActionTargets of [
        getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: homePlanet.id }),
        getActionToSubmintegrationTest(fundedView, GainFuel.id),
        getActionToSubmintegrationTest(fundedView, GainInfluence.id),
      ]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fundedView.turn,
          submittedActionTargets,
        })
      }
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const movingFleet = builtView.fleets[0]
      Assert.isDefined(movingFleet)
      expect(builtView.fleets).toHaveLength(1)

      // Move the first fleet away, then build a second fleet at home.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(builtView, MoveFleetImproved.id, {
          fleet: movingFleet.id,
          planet: nearbyPlanet.id,
        }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const awayView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(awayView.fleets).toStrictEqual([{ ...movingFleet, originPlanetId: nearbyPlanet.id }])

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: awayView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(awayView, BuildFleetStandard.id, { planet: homePlanet.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const returnView = await player.client.gameplay.getPlayerView.query({ gameId })
      const stationedFleet = returnView.fleets.find(({ originPlanetId }) => originPlanetId === homePlanet.id)
      Assert.isDefined(stationedFleet)
      expect(returnView.fleets).toHaveLength(2)
      expect(stationedFleet.id).not.toBe(movingFleet.id)
      expect(returnView.fleets.map(({ strength }) => strength)).toStrictEqual([10, 10])

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: returnView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(returnView, MoveFleetImproved.id, {
          fleet: movingFleet.id,
          planet: homePlanet.id,
        }),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const turnResult = await turnProcessor.processNextDueTurn()
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      expect(turnResult).toBe("processed")
      expect(playerView.turn).toBe(6)
      expect(playerView.fleets).toStrictEqual([
        {
          ...stationedFleet,
          strength: 20,
        },
      ])
    })

    integrationTest.for([
      { turnInterval: Time.create(100, UnitOfTime.SECONDS), timeIncrement: Time.create(116, UnitOfTime.SECONDS) },
      { turnInterval: Time.create(100, UnitOfTime.MINUTES), timeIncrement: Time.create(103, UnitOfTime.MINUTES) },
    ])(
      "should schedule the next turn from the current time when the delay exceeds 15 percent of the interval, capped at 2 minutes",
      async ({ turnInterval, timeIncrement }, { db }) => {
        // Arrange
        const clock = new ControlledClock()
        using apiServer = new ApiServer(await createApiStub({ db, clock }))
        const player = await apiServer.createClient({ authenticated: true })

        const { createdGameId } = await player.client.games.create.mutate({
          configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
        })
        await player.client.games.startGame.mutate({ gameId: createdGameId })

        const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

        // Act
        clock.increment({ time: timeIncrement })
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
        await turnProcessor.processNextDueTurn()

        // Assert
        expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
          turn: 2,
          turnEndsAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        })
      },
    )

    integrationTest("should fail the turn when a locked action submission is no longer affordable", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, GainMetal.id),
      })
      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: branded(player.account.id),
          resourceType: ResourceType.INFLUENCE,
          amountDelta: -3,
        }),
      )

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const result = await turnProcessor.processNextDueTurn()

      // Assert
      expect(result).toBe("failed")
    })

    integrationTest("should process only the earliest scheduled turn in one invocation", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // later game
      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process the same turn over time", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 3,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should skip turns that are already processing", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      const processingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: processingGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(processingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: processingGameId })

      // Act
      clock.increment({ time: processingTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const processingResults = await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(processingResults).toStrictEqual<typeof processingResults>(["processed", "idle"])
      expect(await player.client.gameplay.getPlayerView.query({ gameId: processingGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should not process another turn when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const failingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      clock.increment({ time: successfulTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: laterTurnInterval })

      // if rows are locked correctly, processing 2 turns concurrently should result in 2 different turns being processed
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should do nothing if there are no turns left when processing turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      // if rows are locked correctly, processing 2 turns concurrently should result in 1 turn being processed and the other one will do nothing
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should fully process every player and select at most one deterministic winner", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await joiner.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      for (const { player, amountDelta } of [
        { player: creator, amountDelta: 10 },
        { player: joiner, amountDelta: 12 },
      ]) {
        for (const resourceType of [ResourceType.INFLUENCE, ResourceType.METAL, ResourceType.FUEL, ResourceType.ENERGY]) {
          const updateResourceResult = await resourcesRepository.updateResource({
            gameId: createdGameId,
            playerId: branded(player.account.id),
            resourceType,
            amountDelta,
          })
          Assert.isSuccess(updateResourceResult)
        }
        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: 1,
          submittedActionTargets: getActionToSubmintegrationTest(playerView, WinTheGame.id),
        })
      }

      const creatorViewBeforeProcessing = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const joinerViewBeforeProcessing = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
      const expectedWinnerId = [creator.account.id, joiner.account.id].sort()[0]

      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby).toMatchObject({
        winnerAccountId: expectedWinnerId,
        endedAt: expect.any(String),
      })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(creatorView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
        },
        actions: creatorViewBeforeProcessing.actions, // We should see the submitted actions for that turn
      })

      const joinerView = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 5, uncommitted: 5 },
        },
        actions: joinerViewBeforeProcessing.actions, // We should see the submitted actions for that turn
      })
    })

    integrationTest("should not do anything in case of failure", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ turnIntervalSeconds: 10 }),
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

function getActionToSubmintegrationTest(
  playerView: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> = {},
): DeepUnbranded<SubmittedActionTargetsDto> {
  const action = playerView.actions.find((availableAction) => availableAction.actionDefinitionId === actionDefinitionId)
  Assert.isDefined(action)
  return {
    actionId: action.id,
    selectedTargets,
  }
}

class FailingTurnsRepository extends TurnsRepository {
  private readonly failingGameId: number

  public shouldFail = true

  public constructor({
    db,
    logger,
    failingGameId,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTurn(processedTurn: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    if (processedTurn.gameId === this.failingGameId && this.shouldFail) {
      return Result.Failure("Expected turn save failure")
    }

    return await super.saveProcessedTurn(processedTurn)
  }
}
