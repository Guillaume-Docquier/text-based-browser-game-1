import { Assert, branded, Datetime, type DeepUnbranded, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { asc, eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import {
  BuildFleetExceptional,
  BuildFleetImproved,
  BuildFleetStandard,
} from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainEnergy } from "shared/testing/test-ruleset/action-definitions/gain-energy.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { afterEach, describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import {
  actionsTable,
  fleetsTable,
  gamesTable,
  planetsTable,
  playersTable,
  resourcesTable,
  starsTable,
  turnsTable,
} from "#lib/db/schema.ts"
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.games.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        submittedActionTargets: { actionId: buildFleet.id, selectedTargets: { planet: homePlanet.id }, selectedInputs: {} },
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
        configuration: createGameConfigurationStub({
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
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetImproved.id,
          {
            fleet: fleet.id,
            planet: destination.id,
          },
          { strength: fleet.strength },
        ),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const firstTurnResult = await turnProcessor.processNextDueTurn()
      const inTransitView = await player.client.gameplay.getPlayerView.query({ gameId })
      const journey = inTransitView.fleets[0]
      Assert.isDefined(journey)

      const inTransitAction = inTransitView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(inTransitAction)
      expect(inTransitAction.isInProgress).toBe(true)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: inTransitView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(
            inTransitView,
            MoveFleetImproved.id,
            { fleet: journey.id, planet: origin.id },
            { strength: 1 },
          ),
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: inTransitView.turn,
          submittedActionTargets: { actionId: inTransitAction.id, selectedTargets: null, selectedInputs: null },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const secondTurnResult = await turnProcessor.processNextDueTurn()
      const landedView = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      expect(firstTurnResult).toBe("processed")
      expect(secondTurnResult).toBe("processed")
      expect(inTransitView.turn).toBe(4)
      expect(inTransitView.fleets).toHaveLength(1)
      expect(journey).toMatchObject({
        ownerPlayerId: player.account.id,
        strength: fleet.strength,
        originPlanetId: origin.id,
        destinationPlanetId: destination.id,
        distanceToEnd: expect.closeTo(0.1456435045942517, 12),
      })
      expect(journey.id).not.toBe(fleet.id)
      expect(landedView.turn).toBe(5)
      expect(landedView.fleets).toStrictEqual([
        {
          id: journey.id,
          name: journey.name,
          ownerPlayerId: journey.ownerPlayerId,
          strength: journey.strength,
          originPlanetId: destination.id,
        },
      ])
    })

    integrationTest("should persist one movement payment through two no-submission continuations", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(SlowContinuationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: SlowContinuationRuleset.id,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      expect(Math.hypot(destination.x - origin.x, destination.y - origin.y)).toBeCloseTo(1.1456435045942517, 12)

      const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetImproved.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(initialView, BuildFleetImproved.id, { planet: origin.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const moveAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(moveAction)
      expect(sourceFleet.strength).toBe(100)
      const resourcesBeforeDeparture = builtView.resources
      expect(resourcesBeforeDeparture).toStrictEqual({
        [ResourceType.INFLUENCE]: { total: 94, uncommitted: 94 },
        [ResourceType.METAL]: { total: 97, uncommitted: 97 },
        [ResourceType.FUEL]: { total: 100, uncommitted: 100 },
        [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
        [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
      })

      // Act
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetStandard.id,
          { fleet: sourceFleet.id, planet: destination.id },
          { strength: 20 },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const departedView = await player.client.gameplay.getPlayerView.query({ gameId })
      // Assert
      const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
      const remainder = departedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)
      Assert.isDefined(journey)
      Assert.isDefined(remainder)
      const expectedMovementProvenance = {
        speed: 0.5,
        departureTurn: builtView.turn,
        submission: {
          id: moveAction.id,
          playerId: builtView.player.id,
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 20 },
        },
      }
      const expectedResourcesAfterPayment = {
        [ResourceType.INFLUENCE]: { total: 91, uncommitted: 91 },
        [ResourceType.METAL]: { total: 97, uncommitted: 97 },
        [ResourceType.FUEL]: { total: 99, uncommitted: 99 },
        [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
        [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
      }
      expect(departedView.resources).toStrictEqual(expectedResourcesAfterPayment)
      expect(remainder).toMatchObject({ strength: 80, originPlanetId: origin.id })
      expect(journey.movement).toStrictEqual(expectedMovementProvenance)
      expect(journey).toMatchObject({
        strength: 20,
        originPlanetId: origin.id,
        destinationPlanetId: destination.id,
        distanceToEnd: expect.closeTo(0.6456435045942517, 12),
        movement: {
          speed: 0.5,
          departureTurn: builtView.turn,
          submission: {
            id: moveAction.id,
            actionDefinitionId: MoveFleetStandard.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 20 },
          },
        },
      })
      expect(departedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)

      // No submissions are made in either continuation turn; each reload reads the saved journey.
      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const continuedView = await player.client.gameplay.getPlayerView.query({ gameId })
      const continuedJourney = continuedView.fleets.find(({ id }) => id === journey.id)
      Assert.isDefined(continuedJourney)
      // Assert
      expect(continuedJourney.movement).toStrictEqual(expectedMovementProvenance)
      expect(continuedJourney).toMatchObject({
        strength: 20,
        destinationPlanetId: destination.id,
        distanceToEnd: expect.closeTo(0.1456435045942517, 12),
      })
      expect(continuedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
      expect(continuedView.resources).toStrictEqual(expectedResourcesAfterPayment)

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const landedView = await player.client.gameplay.getPlayerView.query({ gameId })
      // Assert
      expect(landedView.turn).toBe(builtView.turn + 3)
      expect(landedView.fleets.find(({ id }) => id === journey.id)).toStrictEqual({
        id: journey.id,
        name: journey.name,
        ownerPlayerId: journey.ownerPlayerId,
        strength: 20,
        originPlanetId: destination.id,
      })
      expect(landedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)).toMatchObject({
        strength: 80,
        originPlanetId: origin.id,
      })
      expect(landedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(false)
      expect(landedView.resources).toStrictEqual(expectedResourcesAfterPayment)
    })

    integrationTest("should leave persisted game state unchanged when a journey has a corrupt movement binding", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(SlowContinuationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: SlowContinuationRuleset.id,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetImproved.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: origin.id }, selectedInputs: {} },
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const moveAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(moveAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetStandard.id,
          { fleet: sourceFleet.id, planet: destination.id },
          { strength: 20 },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const departedView = await player.client.gameplay.getPlayerView.query({ gameId })
      const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
      Assert.isDefined(journey)
      Assert.isDefined(journey.movement)
      const corruptedMovement = structuredClone(journey.movement)
      const incorrectStrength = journey.strength - 1
      expect(incorrectStrength).toBeGreaterThan(0)
      Assert.isTrue(Reflect.set(corruptedMovement.submission.selectedInputs, "strength", incorrectStrength))
      const updatedRows = await db
        .update(fleetsTable)
        .set({ movement: corruptedMovement })
        .where(eq(fleetsTable.id, journey.id))
        .returning({ id: fleetsTable.id })

      expect(updatedRows).toStrictEqual([{ id: journey.id }])

      const readPersistedGameState = async (): Promise<{
        games: Array<typeof gamesTable.$inferSelect>
        players: Array<typeof playersTable.$inferSelect>
        resources: Array<typeof resourcesTable.$inferSelect>
        actions: Array<typeof actionsTable.$inferSelect>
        stars: Array<typeof starsTable.$inferSelect>
        planets: Array<typeof planetsTable.$inferSelect>
        fleets: Array<typeof fleetsTable.$inferSelect>
      }> => {
        const [games, players, resources, actions, stars, planets, fleets] = await Promise.all([
          db.select().from(gamesTable).where(eq(gamesTable.id, gameId)),
          db.select().from(playersTable).where(eq(playersTable.gameId, gameId)).orderBy(asc(playersTable.playerId)),
          db
            .select()
            .from(resourcesTable)
            .where(eq(resourcesTable.gameId, gameId))
            .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
          db
            .select()
            .from(actionsTable)
            .where(eq(actionsTable.gameId, gameId))
            .orderBy(asc(actionsTable.playerId), asc(actionsTable.turn), asc(actionsTable.id)),
          db.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(asc(starsTable.id)),
          db.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(asc(planetsTable.id)),
          db.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)).orderBy(asc(fleetsTable.id)),
        ])
        return { games, players, resources, actions, stars, planets, fleets }
      }

      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const gameStateBeforeFailure = await readPersistedGameState()
      const turnsBeforeFailure = await db
        .select({ turn: turnsTable.turn, status: turnsTable.status })
        .from(turnsTable)
        .where(eq(turnsTable.gameId, gameId))
        .orderBy(asc(turnsTable.turn))

      // Act
      const processingResult = await turnProcessor.processNextDueTurn()

      // Assert
      expect(processingResult).toBe("failed")
      expect(await readPersistedGameState()).toStrictEqual(gameStateBeforeFailure)
      const turnsAfterFailure = await db
        .select({ turn: turnsTable.turn, status: turnsTable.status })
        .from(turnsTable)
        .where(eq(turnsTable.gameId, gameId))
        .orderBy(asc(turnsTable.turn))
      expect(turnsAfterFailure).toStrictEqual(
        turnsBeforeFailure.map((turn) => (turn.turn === departedView.turn ? { ...turn, status: "PROCESSING" } : turn)),
      )
      expect((await db.select().from(fleetsTable).where(eq(fleetsTable.id, journey.id)))[0]?.movement).toStrictEqual(corruptedMovement)
    })

    integrationTest("should allow a second pooled movement Action while the first instance is in progress", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(MultiInstanceTestRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      const quickDestination = planets.find(({ coordinates }) => coordinates === "45:98:25")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      Assert.isDefined(quickDestination)
      expect(quickDestination.id).not.toBe(origin.id)
      expect(Math.hypot(quickDestination.x - origin.x, quickDestination.y - origin.y)).toBeLessThan(1)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Build to strength 50 through normal submissions; each same-planet build reinforces the stationary Fleet.
      let fleetView = initialView
      for (let count = 0; count < 5; count += 1) {
        const buildAction = fleetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
        Assert.isDefined(buildAction)
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fleetView.turn,
          submittedActionTargets: {
            actionId: buildAction.id,
            selectedTargets: { planet: origin.id },
            selectedInputs: {},
          },
        })
        clock.increment({ time: turnInterval })
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        fleetView = await player.client.gameplay.getPlayerView.query({ gameId })
      }
      expect(fleetView.fleets).toHaveLength(1)
      const sourceFleet = fleetView.fleets[0]
      const firstMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
      const secondMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
      const thirdMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
      const immediateMove = fleetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(firstMove)
      Assert.isDefined(secondMove)
      Assert.isDefined(thirdMove)
      Assert.isDefined(immediateMove)
      expect(sourceFleet.strength).toBe(50)

      // Act
      // Reserve 20 + 15 from one source Fleet. Replacing 15 with 31 would overcommit it by one.
      for (const [action, strength] of [
        [firstMove, 20],
        [secondMove, 15],
      ] as const) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fleetView.turn,
          submittedActionTargets: {
            actionId: action.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength },
          },
        })
      }
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fleetView.turn,
          submittedActionTargets: {
            actionId: secondMove.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 31 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: fleetView.turn,
        submittedActionTargets: {
          actionId: immediateMove.id,
          selectedTargets: { fleet: sourceFleet.id, planet: quickDestination.id },
          selectedInputs: { strength: 1 },
        },
      })
      const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      expect(beforeDeparture.actions.find(({ id }) => id === firstMove.id)?.selectedInputs).toStrictEqual({ strength: 20 })
      expect(beforeDeparture.actions.find(({ id }) => id === secondMove.id)?.selectedInputs).toStrictEqual({ strength: 15 })
      expect(beforeDeparture.actions.find(({ id }) => id === immediateMove.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: quickDestination.id },
        selectedInputs: { strength: 1 },
      })

      // Resolve both accepted allocations and verify the untouched source remainder survived persistence.
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const inTransitView = await player.client.gameplay.getPlayerView.query({ gameId })
      const firstOccupied = inTransitView.actions.find(({ id }) => id === firstMove.id)
      const secondOccupied = inTransitView.actions.find(({ id }) => id === secondMove.id)
      const freeThird = inTransitView.actions.find(({ id }) => id === thirdMove.id)
      const stationaryRemainder = inTransitView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)
      const otherStationaryFleet = inTransitView.fleets.find(({ id, movement }) => id !== sourceFleet.id && movement === undefined)
      Assert.isDefined(firstOccupied)
      Assert.isDefined(secondOccupied)
      Assert.isDefined(freeThird)
      Assert.isDefined(stationaryRemainder)
      Assert.isDefined(otherStationaryFleet)
      expect(stationaryRemainder).toMatchObject({ strength: 14, originPlanetId: origin.id })
      expect(otherStationaryFleet).toMatchObject({ strength: 1, originPlanetId: quickDestination.id })
      expect(otherStationaryFleet.id).not.toBe(stationaryRemainder.id)
      expect(inTransitView.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([
        1, 14, 15, 20,
      ])
      expect(
        inTransitView.fleets
          .filter(({ movement }) => movement !== undefined)
          .map(({ strength }) => strength)
          .toSorted((first, second) => first - second),
      ).toStrictEqual([15, 20])
      expect(firstOccupied.isInProgress).toBe(true)
      expect(secondOccupied.isInProgress).toBe(true)
      expect(freeThird.isInProgress).toBe(false)
      expect(inTransitView.actions.find(({ id }) => id === immediateMove.id)?.isInProgress).toBe(false)

      // Prove the other stationary Fleet and return target are valid with the free instance,
      // cancel that draft, then try the same selection on the occupied instance.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: inTransitView.turn,
        submittedActionTargets: {
          actionId: freeThird.id,
          selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
          selectedInputs: { strength: 1 },
        },
      })
      const validRedirectReference = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(validRedirectReference.actions.find(({ id }) => id === freeThird.id)).toMatchObject({
        selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
        selectedInputs: { strength: 1 },
      })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: inTransitView.turn,
        submittedActionTargets: { actionId: freeThird.id, selectedTargets: null, selectedInputs: null },
      })
      const beforeOccupiedRedirect = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(beforeOccupiedRedirect).toStrictEqual(inTransitView)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: inTransitView.turn,
          submittedActionTargets: {
            actionId: firstOccupied.id,
            selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
            selectedInputs: { strength: 1 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOccupiedRedirect)

      // The third instance remains available while the first two are occupied and cannot select an in-flight child.
      const journeyFleet = inTransitView.fleets.find(({ movement }) => movement !== undefined)
      Assert.isDefined(journeyFleet)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: inTransitView.turn,
          submittedActionTargets: {
            actionId: freeThird.id,
            selectedTargets: { fleet: journeyFleet.id, planet: destination.id },
            selectedInputs: { strength: 1 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOccupiedRedirect)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: inTransitView.turn,
        submittedActionTargets: {
          actionId: freeThird.id,
          selectedTargets: { fleet: stationaryRemainder.id, planet: destination.id },
          selectedInputs: { strength: 14 },
        },
      })

      const updatedView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(updatedView.actions.find(({ id }) => id === firstOccupied.id)?.isInProgress).toBe(true)
      expect(updatedView.actions.find(({ id }) => id === secondOccupied.id)?.isInProgress).toBe(true)
      expect(updatedView.actions.find(({ id }) => id === freeThird.id)?.isInProgress).toBe(false)
      expect(updatedView.actions.find(({ id }) => id === freeThird.id)?.selectedInputs).toStrictEqual({ strength: 14 })
      expect(updatedView.fleets.find(({ id }) => id === otherStationaryFleet.id)).toMatchObject({
        strength: 1,
        originPlanetId: quickDestination.id,
      })
    })

    integrationTest("should merge an arriving fleet with the player's fleet at the destination in one turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
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
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetImproved.id,
          {
            fleet: movingFleet.id,
            planet: nearbyPlanet.id,
          },
          { strength: movingFleet.strength },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const awayView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(awayView.fleets).toHaveLength(1)
      const departedFleet = awayView.fleets[0]
      Assert.isDefined(departedFleet)
      expect(departedFleet).toMatchObject({ originPlanetId: nearbyPlanet.id, strength: movingFleet.strength })
      expect(departedFleet.id).not.toBe(movingFleet.id)

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
        submittedActionTargets: getActionToSubmintegrationTest(
          returnView,
          MoveFleetImproved.id,
          {
            fleet: departedFleet.id,
            planet: homePlanet.id,
          },
          { strength: departedFleet.strength },
        ),
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

    integrationTest("should persist an ordinary arrival separately from an enemy fleet at the destination", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(EnemyArrivalRuleset))
      using apiServer = new ApiServer(apiServices)
      const attacker = await apiServer.createClient({ authenticated: true })
      const defender = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await attacker.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: EnemyArrivalRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await defender.client.games.join.mutate({ gameId })
      await attacker.client.games.startGame.mutate({ gameId })
      const attackerInitialView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderInitialView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const planets = attackerInitialView.galaxy.systems.flatMap(({ planets }) => planets)
      const attackerPlayerId = branded<PlayerId>(attacker.account.id)
      const defenderPlayerId = branded<PlayerId>(defender.account.id)
      const attackerHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defenderHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      Assert.isDefined(attackerHome)
      Assert.isDefined(defenderHome)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(attackerInitialView, BuildFleetStandard.id, { planet: attackerHome.id }),
      })
      await defender.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: defenderInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(defenderInitialView, BuildFleetImproved.id, { planet: defenderHome.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const attackerBuiltView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderBuiltView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const attackingFleet = attackerBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defendingFleet = defenderBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      const moveAction = attackerBuiltView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(attackingFleet)
      Assert.isDefined(defendingFleet)
      Assert.isDefined(moveAction)
      expect(attackingFleet).toMatchObject({ strength: 20, originPlanetId: attackerHome.id })
      expect(defendingFleet).toMatchObject({ strength: 7, originPlanetId: defenderHome.id })

      // Act: the public API accepts a normal move; the worker processes its immediate arrival.
      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerBuiltView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          attackerBuiltView,
          MoveFleetStandard.id,
          { fleet: attackingFleet.id, planet: defenderHome.id },
          { strength: 20 },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")

      // Assert: the reloaded public view retains the enemy row unchanged and the arriving force separately.
      const resolvedView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const persistedDefenderHome = resolvedView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === defenderHome.id)
      const persistedEnemyFleet = resolvedView.fleets.find(({ id }) => id === defendingFleet.id)
      const persistedArrival = resolvedView.fleets.find(
        ({ ownerPlayerId, id }) => ownerPlayerId === attackerPlayerId && id !== attackingFleet.id,
      )
      Assert.isDefined(persistedEnemyFleet)
      Assert.isDefined(persistedArrival)
      Assert.isDefined(persistedDefenderHome)
      expect(persistedDefenderHome.ownerPlayerId).toBe(defenderPlayerId)
      expect(resolvedView.fleets).toHaveLength(2)
      expect(persistedEnemyFleet).toStrictEqual({
        id: defendingFleet.id,
        name: defendingFleet.name,
        ownerPlayerId: defenderPlayerId,
        strength: 7,
        originPlanetId: defenderHome.id,
      })
      expect(persistedArrival).toMatchObject({
        ownerPlayerId: attackerPlayerId,
        strength: 20,
        originPlanetId: defenderHome.id,
      })
      expect(persistedArrival.id).not.toBe(attackingFleet.id)
      expect(persistedArrival).not.toHaveProperty("movement")
      expect(persistedArrival).not.toHaveProperty("destinationPlanetId")
      expect(persistedArrival).not.toHaveProperty("distanceToEnd")
      expect(resolvedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(false)
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
          configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(processingTurnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
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
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
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
      const postSpendAffordability = {
        [GainInfluence.id]: true,
        [WinTheGame.id]: false,
        [GainEnergy.id]: true,
        [GainFuel.id]: true,
        [GainMetal.id]: true,
        [BuildFleetStandard.id]: true,
        [BuildFleetImproved.id]: false,
        [BuildFleetExceptional.id]: false,
        [MoveFleetStandard.id]: true,
        [MoveFleetImproved.id]: true,
        [MoveFleetExceptional.id]: true,
      }

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
        actions: creatorViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: postSpendAffordability[action.actionDefinitionId],
        })),
      })

      const joinerView = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 5, uncommitted: 5 },
        },
        actions: joinerViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: postSpendAffordability[action.actionDefinitionId],
        })),
      })
    })

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

const MultiInstanceTestRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

const SlowMoveFleetStandard = ActionDefinitionSchema.parse({
  ...MoveFleetStandard,
  effects: MoveFleetStandard.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 0.5 } } : effect,
  ),
})

const SlowContinuationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_slow_continuation_payment",
  name: "Slow Continuation Payment Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [SlowMoveFleetStandard.id]: SlowMoveFleetStandard },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

const WorkerEnemyArrivalBuildStandard = ActionDefinitionSchema.parse({
  ...BuildFleetStandard,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 20 })],
})
const WorkerEnemyArrivalBuildImproved = ActionDefinitionSchema.parse({
  ...BuildFleetImproved,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 7 })],
})
const WorkerEnemyArrivalMoveStandard = ActionDefinitionSchema.parse({
  ...MoveFleetStandard,
  targets: {
    ...MoveFleetStandard.targets,
    [branded<TargetTag>("planet")]: {
      ...MoveFleetStandard.targets[branded<TargetTag>("planet")],
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 100_000 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
      ],
    },
  },
  effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 100_000 })],
})

const EnemyArrivalRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_worker_enemy_arrival",
  name: "Worker Enemy Arrival Test",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [WorkerEnemyArrivalBuildStandard.id]: WorkerEnemyArrivalBuildStandard,
    [WorkerEnemyArrivalBuildImproved.id]: WorkerEnemyArrivalBuildImproved,
    [WorkerEnemyArrivalMoveStandard.id]: WorkerEnemyArrivalMoveStandard,
  },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

function getActionToSubmintegrationTest(
  playerView: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> = {},
  selectedInputs: DeepUnbranded<NonNullable<SubmittedActionTargetsDto["selectedInputs"]>> = {},
): DeepUnbranded<SubmittedActionTargetsDto> {
  const action = playerView.actions.find((availableAction) => availableAction.actionDefinitionId === actionDefinitionId)
  Assert.isDefined(action)
  return {
    actionId: action.id,
    selectedTargets,
    selectedInputs,
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
