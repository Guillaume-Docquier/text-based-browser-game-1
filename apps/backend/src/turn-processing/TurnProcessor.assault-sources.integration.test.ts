import { Assert, branded, Datetime, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetImproved, BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import type { Planet, PlayerView, Fleet, Action } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  assertUpdatedRows,
  assertSourceFleet2,
  assertStationaryRemainder,
  assertPlayer,
} from "../tests/fleet-assertions/TurnProcessor.assault-sources-2.ts"
import {
  assertTurnProcessor,
  assertInTransitAction,
  assertSourceFleet,
  assertDepartedView,
  assertContinuedJourney,
} from "../tests/fleet-assertions/TurnProcessor.assault-sources.ts"
import { getActionToSubmintegrationTest } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { MultiInstanceTestRuleset, SlowContinuationRuleset } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
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

      await assertTurnProcessor({ player, gameId, initialView, clock, turnInterval, turnsRepository, turnProcessor, origin })
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

      await assertInTransitAction({
        inTransitAction,
        player,
        gameId,
        inTransitView,
        journey,
        origin,
        clock,
        turnInterval,
        turnsRepository,
        turnProcessor,
        firstTurnResult,
        fleet,
        destination,
      })
    })

    integrationTest("should persist one movement payment through two no-submission continuations", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(SlowContinuationRuleset))
      using apiServer = new ApiServer(apiServices)

      const createPlayerSetupPhase1Result = await createPlayerSetup({ apiServer, db, clock })
      const {
        player,
        turnInterval,
        gameId,
        turnProcessor,
        turnsRepository,
        origin,
        destination,
        builtView,
        sourceFleet,
        moveAction,
        departedView,
        journey,
      } = createPlayerSetupPhase1Result
      const remainder = departedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)
      Assert.isDefined(journey)
      Assert.isDefined(remainder)

      const createExpectedMovementProvenanceSetupPhase2Result = await createExpectedMovementProvenanceSetup({
        ...createPlayerSetupPhase1Result,
        remainder,
        journey,
        clock,
      })
      const { expectedMovementProvenance, expectedResourcesAfterPayment, continuedView, continuedJourney } =
        createExpectedMovementProvenanceSetupPhase2Result
      // Assert

      await assertContinuedJourney({
        continuedJourney,
        expectedMovementProvenance,
        destination,
        continuedView,
        moveAction,
        expectedResourcesAfterPayment,
        clock,
        turnInterval,
        turnsRepository,
        turnProcessor,
        player,
        gameId,
        builtView,
        journey,
        sourceFleet,
        origin,
      })
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

      await assertUpdatedRows({ db, corruptedMovement, journey, gameId, clock, turnInterval, turnsRepository, turnProcessor, departedView })
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

      const createImmediateMoveSetupPhase3Result = await createImmediateMoveSetup({
        fleetView,
        player,
        gameId,
        destination,
        quickDestination,
        clock,
        turnInterval,
        turnsRepository,
        turnProcessor,
      })
      const { inTransitView, firstOccupied, secondOccupied, freeThird, stationaryRemainder, otherStationaryFleet } =
        createImmediateMoveSetupPhase3Result

      const createBeforeOccupiedRedirectSetupPhase4Result = await createBeforeOccupiedRedirectSetup({
        ...createImmediateMoveSetupPhase3Result,
        origin,
        quickDestination,
        player,
        gameId,
      })
      const { beforeOccupiedRedirect, journeyFleet } = createBeforeOccupiedRedirectSetupPhase4Result

      await assertPlayer({
        player,
        gameId,
        inTransitView,
        freeThird,
        journeyFleet,
        destination,
        beforeOccupiedRedirect,
        stationaryRemainder,
        firstOccupied,
        secondOccupied,
        otherStationaryFleet,
        quickDestination,
      })
    })
  })
})

async function createPlayerSetup({ apiServer, db, clock }: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
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

  await assertSourceFleet({ sourceFleet, builtView, player, gameId, destination, clock, turnInterval, turnsRepository, turnProcessor })
  const departedView = await player.client.gameplay.getPlayerView.query({ gameId })
  // Assert
  const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
  return {
    player,
    turnInterval,
    gameId,
    turnProcessor,
    turnsRepository,
    origin,
    destination,
    builtView,
    sourceFleet,
    moveAction,
    departedView,
    journey,
  }
}

async function createExpectedMovementProvenanceSetup({
  builtView,
  moveAction,
  sourceFleet,
  destination,
  departedView,
  remainder,
  origin,
  journey,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  player,
  gameId,
}: CreateExpectedMovementProvenanceSetupInput): Promise<CreateExpectedMovementProvenanceSetupResult> {
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
    pendingArrivalEffects: [],
  }
  const expectedResourcesAfterPayment = {
    [ResourceType.INFLUENCE]: { total: 91, uncommitted: 91 },
    [ResourceType.METAL]: { total: 97, uncommitted: 97 },
    [ResourceType.FUEL]: { total: 99, uncommitted: 99 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
  }

  await assertDepartedView({
    departedView,
    expectedResourcesAfterPayment,
    remainder,
    origin,
    journey,
    expectedMovementProvenance,
    destination,
    builtView,
    moveAction,
    sourceFleet,
    clock,
    turnInterval,
    turnsRepository,
    turnProcessor,
  })
  const continuedView = await player.client.gameplay.getPlayerView.query({ gameId })
  const continuedJourney = continuedView.fleets.find(({ id }) => id === journey.id)
  Assert.isDefined(continuedJourney)
  return { expectedMovementProvenance, expectedResourcesAfterPayment, continuedView, continuedJourney }
}

async function createImmediateMoveSetup({
  fleetView,
  player,
  gameId,
  destination,
  quickDestination,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
}: CreateImmediateMoveSetupInput): Promise<CreateImmediateMoveSetupResult> {
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

  await assertSourceFleet2({
    sourceFleet,
    firstMove,
    secondMove,
    player,
    gameId,
    fleetView,
    destination,
    immediateMove,
    quickDestination,
    clock,
    turnInterval,
    turnsRepository,
    turnProcessor,
  })
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
  return { immediateMove, inTransitView, firstOccupied, secondOccupied, freeThird, stationaryRemainder, otherStationaryFleet }
}

async function createBeforeOccupiedRedirectSetup({
  stationaryRemainder,
  origin,
  otherStationaryFleet,
  quickDestination,
  inTransitView,
  firstOccupied,
  secondOccupied,
  freeThird,
  immediateMove,
  player,
  gameId,
}: CreateBeforeOccupiedRedirectSetupInput): Promise<CreateBeforeOccupiedRedirectSetupResult> {
  await assertStationaryRemainder({
    stationaryRemainder,
    origin,
    otherStationaryFleet,
    quickDestination,
    inTransitView,
    firstOccupied,
    secondOccupied,
    freeThird,
    immediateMove,
    player,
    gameId,
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
  return { beforeOccupiedRedirect, journeyFleet }
}

type CreatePlayerSetupInput = { apiServer: ApiServer; db: Database; clock: ControlledClock }

type CreatePlayerSetupResult = {
  player: AuthenticatedApiClient
  turnInterval: Time<UnitOfTime.SECONDS>
  gameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  origin: Planet
  destination: Planet
  builtView: PlayerView
  sourceFleet: Fleet
  moveAction: Action
  departedView: PlayerView
  journey: undefined | Fleet
}

type CreateExpectedMovementProvenanceSetupInput = {
  builtView: PlayerView
  moveAction: Action
  sourceFleet: Fleet
  destination: Planet
  departedView: PlayerView
  remainder: Fleet
  origin: Planet
  journey: Fleet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: GameId
}

type CreateExpectedMovementProvenanceSetupResult = {
  expectedMovementProvenance: {
    speed: number
    departureTurn: number
    submission: {
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: { fleet: FleetId; planet: PlanetId }
      selectedInputs: { strength: number }
    }
    pendingArrivalEffects: never[]
  }
  expectedResourcesAfterPayment: {
    INFLUENCE: { total: number; uncommitted: number }
    METAL: { total: number; uncommitted: number }
    FUEL: { total: number; uncommitted: number }
    ENERGY: { total: number; uncommitted: number }
    COLONY: { total: number; uncommitted: number }
  }
  continuedView: PlayerView
  continuedJourney: Fleet
}

type CreateImmediateMoveSetupInput = {
  fleetView: PlayerView
  player: AuthenticatedApiClient
  gameId: GameId
  destination: Planet
  quickDestination: Planet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

type CreateImmediateMoveSetupResult = {
  immediateMove: Action
  inTransitView: PlayerView
  firstOccupied: Action
  secondOccupied: Action
  freeThird: Action
  stationaryRemainder: Fleet
  otherStationaryFleet: Fleet
}

type CreateBeforeOccupiedRedirectSetupInput = {
  stationaryRemainder: Fleet
  origin: Planet
  otherStationaryFleet: Fleet
  quickDestination: Planet
  inTransitView: PlayerView
  firstOccupied: Action
  secondOccupied: Action
  freeThird: Action
  immediateMove: Action
  player: AuthenticatedApiClient
  gameId: GameId
}

type CreateBeforeOccupiedRedirectSetupResult = { beforeOccupiedRedirect: PlayerView; journeyFleet: Fleet }
