import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView, Planet, Fleet, Action } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { assertBeforeOutOfRangeAttempt } from "../../tests/fleet-assertions/gameplay.router.composed-parity-2.ts"
import {
  ComposedGainReservationRuleset,
  TestMovementVerificationRuleset,
  processNextRouterTurn,
  withDefaultActionViewFields,
} from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("gameplay.router", () => {
  describe("updateActionSubmission", () => {
    integrationTest("should not count a selected same-turn Influence gain toward an Attack Move", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(ComposedGainReservationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: ComposedGainReservationRuleset.id,
          mapGenerationSeed: 1234,
          turnIntervalSeconds: 10,
        }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      let playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)

      const updatedVerifyActionSelections = await verifyActionSelections({
        origin,
        destination,
        playerView,
        player,
        createdGameId,
        clock,
        turnProcessor,
        turnsRepository,
      })
      playerView = updatedVerifyActionSelections.playerView

      const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const gainAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      const moveAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      const attackAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(gainAction)
      Assert.isDefined(moveAction)
      Assert.isDefined(attackAction)

      await verifySourceFleet({ sourceFleet, playerView, player, createdGameId, gainAction, moveAction, destination })

      await verifyGainAndMoveView({ player, createdGameId, gainAction, moveAction, sourceFleet, destination, attackAction })
    })

    integrationTest("should enforce Exceptional range and resolve configured movement speeds", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(TestMovementVerificationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: TestMovementVerificationRuleset.id,
          mapGenerationSeed: 1234,
          turnIntervalSeconds: 10,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
      Assert.isDefined(origin)
      const unowned = planets.filter(({ ownerPlayerId, id }) => ownerPlayerId === null && id !== origin.id)
      const distanceFromOrigin = (planet: (typeof unowned)[number]): number => Math.hypot(planet.x - origin.x, planet.y - origin.y)

      const createStandardDestinationSetupPhase1Result = await createStandardDestinationSetup({
        unowned,
        distanceFromOrigin,
        initialView,
        player,
        gameId,
        origin,
        clock,
        turnProcessor,
        turnsRepository,
      })
      const { builtView, sourceFleet, standardAction, improvedAction } = createStandardDestinationSetupPhase1Result
      const exceptionalAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(standardAction)
      Assert.isDefined(improvedAction)
      Assert.isDefined(exceptionalAction)

      // Act

      await verifyPublicState({
        ...createStandardDestinationSetupPhase1Result,
        player,
        gameId,
        exceptionalAction,
        sourceFleet,
        standardAction,
        improvedAction,
        clock,
        turnProcessor,
        turnsRepository,
        initialView,
        origin,
      })
    })

    integrationTest("should reject a Fleet ID that exists only in another game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const configuration = createGameConfigurationStub({ mapGenerationSeed: 1234, turnIntervalSeconds: 10 })
      const { createdGameId: sourceGameId } = await player.client.games.create.mutate({ configuration })
      const { createdGameId: targetGameId } = await player.client.games.create.mutate({ configuration })
      await player.client.games.startGame.mutate({ gameId: sourceGameId })
      await player.client.games.startGame.mutate({ gameId: targetGameId })

      const sourceView = await player.client.gameplay.getPlayerView.query({ gameId: sourceGameId })
      const sourceHome = sourceView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const buildAction = sourceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(sourceHome)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: sourceGameId,
        turn: sourceView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildAction.id,
          selectedTargets: { planet: sourceHome.id },
          selectedInputs: {},
        }),
      })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const sourceGameAfterTurn = await player.client.gameplay.getPlayerView.query({ gameId: sourceGameId })
      const foreignFleet = sourceGameAfterTurn.fleets[0]
      Assert.isDefined(foreignFleet)

      const targetView = await player.client.gameplay.getPlayerView.query({ gameId: targetGameId })
      const moveAction = targetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      const targetPlanet = targetView.galaxy.systems.flatMap(({ planets }) => planets).find(({ ownerPlayerId }) => ownerPlayerId === null)
      Assert.isDefined(moveAction)
      Assert.isDefined(targetPlanet)
      const targetResourcesBefore = targetView.resources

      // Act
      const submission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: targetGameId,
        turn: targetView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: moveAction.id,
          selectedTargets: { fleet: foreignFleet.id, planet: targetPlanet.id },
          selectedInputs: { strength: 1 },
        }),
      })

      // Assert
      await expect(submission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const targetViewAfter = await player.client.gameplay.getPlayerView.query({ gameId: targetGameId })
      const unchangedMoveAction = targetViewAfter.actions.find(({ id }) => id === moveAction.id)
      Assert.isDefined(unchangedMoveAction)
      expect(unchangedMoveAction.selectedTargets).toBeNull()
      expect(unchangedMoveAction.selectedInputs).toBeNull()
      expect(unchangedMoveAction.isInProgress).toBe(false)
      expect(targetViewAfter.resources).toStrictEqual(targetResourcesBefore)
    })

    integrationTest("should update only the submitting player's Action when players share stable Action IDs", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const opponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await opponent.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const creatorAction = creatorView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(creatorAction)

      const opponentView = await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const opponentAction = opponentView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(opponentAction)

      // Act
      await creator.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: creatorView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: creatorAction.id, selectedTargets: {} }),
      })

      // Assert
      expect(creatorAction.id).toBe(opponentAction.id)
      expect(
        (await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === creatorAction.id),
      ).toMatchObject({ selectedTargets: {} })
      expect(
        (await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === opponentAction.id),
      ).toMatchObject({ selectedTargets: null })
    })

    integrationTest("should submit and deselect multiple actions", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const createSelectedPlayerViewSetupPhase2Result = await createSelectedPlayerViewSetup({ apiServer })
      const { selectedPlayerView, deselectedPlayerView } = createSelectedPlayerViewSetupPhase2Result

      // Assert

      expect(selectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedSelectedActions.map(withDefaultActionViewFields)))
      expect(selectedPlayerView.actions).toHaveLength(expectedSelectedActions.length)

      expect(deselectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedDeselectedActions.map(withDefaultActionViewFields)))
      expect(deselectedPlayerView.actions).toHaveLength(expectedDeselectedActions.length)
    })

    integrationTest.for(["constructor", "toString"])(
      "should reject inherited input name %s for an action with no inputs",
      async (inputTag, { db }) => {
        // Arrange
        using apiServer = new ApiServer(await createApiStub({ db }))
        const player = await apiServer.createClient({ authenticated: true })
        const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
        await player.client.games.startGame.mutate({ gameId: createdGameId })

        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
        const campaign = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
        Assert.isDefined(campaign)

        // Act
        const invalidSubmission = player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: campaign.id,
            selectedTargets: {},
            selectedInputs: Object.fromEntries([[inputTag, 1]]),
          }),
        })

        // Assert
        await expect(invalidSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      },
    )
  })
})

async function verifyActionSelections({
  origin,
  destination,
  playerView,
  player,
  createdGameId,
  clock,
  turnProcessor,
  turnsRepository,
}: VerifyActionSelectionsInput): Promise<VerifyActionSelectionsResult> {
  expect({ x: origin.x, y: origin.y }).toStrictEqual(FleetActionSelectionParity.origin)
  expect({ x: destination.x, y: destination.y }).toStrictEqual(FleetActionSelectionParity.destination)

  // Act
  for (let buildCount = 0; buildCount < 5; buildCount += 1) {
    const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: playerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: buildAction.id,
        selectedTargets: { planet: origin.id },
        selectedInputs: {},
      }),
    })
    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  }

  return { playerView }
}

async function verifySourceFleet({
  sourceFleet,
  playerView,
  player,
  createdGameId,
  gainAction,
  moveAction,
  destination,
}: VerifySourceFleetInput): Promise<void> {
  expect(sourceFleet.strength).toBe(50)
  expect(playerView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 7, uncommitted: 7 })
  expect(playerView.resources[ResourceType.METAL].total).toBe(5)
  expect(playerView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 2 })

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: gainAction.id,
      selectedTargets: {},
      selectedInputs: {},
    }),
  })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: playerView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: moveAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    }),
  })
}

async function verifyGainAndMoveView({
  player,
  createdGameId,
  gainAction,
  moveAction,
  sourceFleet,
  destination,
  attackAction,
}: VerifyGainAndMoveViewInput): Promise<void> {
  const gainAndMoveView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  expect(gainAndMoveView.actions.find(({ id }) => id === gainAction.id)).toMatchObject({ selectedTargets: {}, selectedInputs: {} })
  expect(gainAndMoveView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
    selectedInputs: { strength: 20 },
  })
  expect(gainAndMoveView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 7, uncommitted: 4 })
  expect(gainAndMoveView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })

  // Assert
  const attackAfterGainAndMove = player.client.gameplay.updateActionSubmission.mutate({
    gameId: createdGameId,
    turn: gainAndMoveView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: attackAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 30 },
    }),
  })
  await expect(attackAfterGainAndMove).rejects.toThrow("Invalid action submission, targets are invalid or costs cannot be paid.")
  await expect(attackAfterGainAndMove).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(gainAndMoveView)
}

async function verifyPublicState({
  player,
  gameId,
  builtView,
  exceptionalAction,
  sourceFleet,
  beyondExceptionalRange,
  standardAction,
  standardDestination,
  improvedAction,
  improvedDestination,
  exceptionalDestination,
  clock,
  turnProcessor,
  turnsRepository,
  initialView,
  origin,
}: VerifyPublicStateInput): Promise<void> {
  await assertBeforeOutOfRangeAttempt({
    player,
    gameId,
    builtView,
    exceptionalAction,
    sourceFleet,
    beyondExceptionalRange,
    standardAction,
    standardDestination,
    improvedAction,
    improvedDestination,
    exceptionalDestination,
    clock,
    turnProcessor,
    turnsRepository,
    initialView,
    origin,
  })
}

type VerifyActionSelectionsInput = {
  origin: Planet
  destination: Planet
  playerView: PlayerView
  player: AuthenticatedApiClient
  createdGameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
}

type VerifyActionSelectionsResult = { playerView: PlayerView }

type VerifySourceFleetInput = {
  sourceFleet: Fleet
  playerView: PlayerView
  player: AuthenticatedApiClient
  createdGameId: GameId
  gainAction: Action
  moveAction: Action
  destination: Planet
}

type VerifyGainAndMoveViewInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  gainAction: Action
  moveAction: Action
  sourceFleet: Fleet
  destination: Planet
  attackAction: Action
}

type VerifyPublicStateInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  exceptionalAction: Action
  sourceFleet: Fleet
  beyondExceptionalRange: Planet
  standardAction: Action
  standardDestination: Planet
  improvedAction: Action
  improvedDestination: Planet
  exceptionalDestination: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  initialView: PlayerView
  origin: Planet
}

async function createStandardDestinationSetup({
  unowned,
  distanceFromOrigin,
  initialView,
  player,
  gameId,
  origin,
  clock,
  turnProcessor,
  turnsRepository,
}: CreateStandardDestinationSetupInput): Promise<CreateStandardDestinationSetupResult> {
  const standardDestination = unowned.find(({ coordinates }) => coordinates === "45:87:40")
  const improvedDestination = unowned.find(({ coordinates }) => coordinates === "45:18:35")
  const exceptionalDestination = unowned.find(({ coordinates }) => coordinates === "54:18:10")
  const beyondExceptionalRange = unowned.find(({ coordinates }) => coordinates === "63:50:25")
  Assert.isDefined(standardDestination)
  Assert.isDefined(improvedDestination)
  Assert.isDefined(exceptionalDestination)
  Assert.isDefined(beyondExceptionalRange)
  expect(distanceFromOrigin(standardDestination)).toBeCloseTo(1.9357059928924176, 12)
  expect(distanceFromOrigin(improvedDestination)).toBeCloseTo(7.693909440718526, 12)
  expect(distanceFromOrigin(exceptionalDestination)).toBeCloseTo(10.129282735155494, 12)
  expect(distanceFromOrigin(beyondExceptionalRange)).toBeCloseTo(31.73237553747045, 12)

  const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(buildAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: initialView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: buildAction.id,
      selectedTargets: { planet: origin.id },
      selectedInputs: {},
    }),
  })
  await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
  const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
  const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
  const standardAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
  const improvedAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
  return {
    standardDestination,
    improvedDestination,
    exceptionalDestination,
    beyondExceptionalRange,
    builtView,
    sourceFleet,
    standardAction,
    improvedAction,
  }
}

async function createSelectedPlayerViewSetup({
  apiServer,
}: CreateSelectedPlayerViewSetupInput): Promise<CreateSelectedPlayerViewSetupResult> {
  const player = await apiServer.createClient({ authenticated: true })
  const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
  await player.client.games.startGame.mutate({ gameId: createdGameId })

  const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const gainFuel = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainFuel.id)
  const gainMetal = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
  Assert.isDefined(gainFuel)
  Assert.isDefined(gainMetal)

  // Act
  for (const action of [gainFuel, gainMetal]) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: initialPlayerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: {} }),
    })
  }
  const selectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

  for (const action of [gainFuel, gainMetal]) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: initialPlayerView.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: null }),
    })
  }
  const deselectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  return { selectedPlayerView, deselectedPlayerView }
}

type CreateStandardDestinationSetupInput = {
  unowned: Planet[]
  distanceFromOrigin: (planet: Planet) => number
  initialView: PlayerView
  player: AuthenticatedApiClient
  gameId: GameId
  origin: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
}

type CreateStandardDestinationSetupResult = {
  standardDestination: Planet
  improvedDestination: Planet
  exceptionalDestination: Planet
  beyondExceptionalRange: Planet
  builtView: PlayerView
  sourceFleet: undefined | Fleet
  standardAction: undefined | Action
  improvedAction: undefined | Action
}

type CreateSelectedPlayerViewSetupInput = { apiServer: ApiServer }

type CreateSelectedPlayerViewSetupResult = { selectedPlayerView: PlayerView; deselectedPlayerView: PlayerView }

const expectedSelectedActions = [
  {
    id: expect.any(String),
    actionDefinitionId: GainInfluence.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: WinTheGame.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainEnergy.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainFuel.id,
    selectedTargets: {},
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainMetal.id,
    selectedTargets: {},
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetStandard.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetExceptional.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: "MOVE_FLEET_IMPROVED_2",
    actionDefinitionId: MoveFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: AttackMoveTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: FlexibleAssaultTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: "TEST_COLONIZE_PLANET_1",
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: "TEST_COLONIZE_HERE_1",
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: null,
    canAfford: false,
  },
]

const expectedDeselectedActions = [
  {
    id: expect.any(String),
    actionDefinitionId: GainInfluence.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: WinTheGame.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainEnergy.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainFuel.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: GainMetal.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetStandard.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: BuildFleetExceptional.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: "MOVE_FLEET_IMPROVED_2",
    actionDefinitionId: MoveFleetImproved.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: AttackMoveTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: FlexibleAssaultTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: expect.any(String),
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: null,
    canAfford: true,
  },
  {
    id: "TEST_COLONIZE_PLANET_1",
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: null,
    canAfford: false,
  },
  {
    id: "TEST_COLONIZE_HERE_1",
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: null,
    canAfford: false,
  },
]
