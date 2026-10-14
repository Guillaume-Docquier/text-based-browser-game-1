import { Assert, branded, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Action, Fleet } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  StrengthRaceRuleset,
  ResourceRaceRuleset,
  processManualDeadlineTurn,
  normalizeApiDate,
  createStartGate,
  submitActionAfterGate,
} from "../fleet-concurrency/gameplay.scenarios.ts"
import { MANUAL_WORKER_TURN_INTERVAL } from "../fleet-concurrency/gameplay.ts"

export async function assertBuildCount({
  playerView,
  player,
  strengthGameId,
  origin,
  clock,
  turnProcessor,
  turnsRepository,
}: AssertBuildCountInput): Promise<AssertBuildCountResult> {
  for (let buildCount = 0; buildCount < 5; buildCount += 1) {
    const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: origin.id },
        selectedInputs: {},
      },
    })
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId: strengthGameId,
      turn: playerView.turn,
    })
    playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
  }

  return { playerView }
}

export type AssertBuildCountInput = {
  playerView: PlayerView
  player: AuthenticatedApiClient
  strengthGameId: GameId
  origin: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
}

export type AssertBuildCountResult = { playerView: PlayerView }

export async function assertCancelReplaceResults(input: AssertCancelReplaceResultsInput): Promise<void> {
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.strengthGameId,
    turn: input.playerView.turn,
    submittedActionTargets: { actionId: input.selectedThirtyAction.id, selectedTargets: null, selectedInputs: null },
  })

  // Cancel and replace the same instance concurrently; PostgreSQL may serialize either
  // mutation first, so the persisted selection and reservations must match one complete
  // serialized outcome rather than client response order.
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.strengthGameId,
    turn: input.playerView.turn,
    submittedActionTargets: {
      actionId: input.moveThree.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 20 },
    },
  })
  const cancelReplaceGate = createStartGate(2)
  const cancelReplaceResults = await Promise.allSettled([
    (async (): Promise<void> => {
      await cancelReplaceGate()
      await input.player.client.gameplay.updateActionSubmission.mutate({
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: { actionId: input.moveThree.id, selectedTargets: null, selectedInputs: null },
      })
    })(),
    (async (): Promise<void> => {
      await cancelReplaceGate()
      await input.player.client.gameplay.updateActionSubmission.mutate({
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.moveThree.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: 19 },
        },
      })
    })(),
  ])
  expect(cancelReplaceResults.every(({ status }) => status === "fulfilled")).toBe(true)
}

export type AssertCancelReplaceResultsInput = {
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  selectedThirtyAction: Action
  moveThree: Action
  sourceFleet: Fleet
  destination: Planet
}

export async function assertPersistedCancelReplaceState(input: AssertPersistedCancelReplaceStateInput): Promise<void> {
  const persistedCancelReplaceState = {
    selectedTargets: input.moveThreeAfterRace.selectedTargets,
    selectedInputs: input.moveThreeAfterRace.selectedInputs,
    influenceUncommitted: input.afterCancelReplace.resources[ResourceType.INFLUENCE].uncommitted,
    fuelUncommitted: input.afterCancelReplace.resources[ResourceType.FUEL].uncommitted,
  }
  expect([
    {
      selectedTargets: null,
      selectedInputs: null,
      influenceUncommitted: 6,
      fuelUncommitted: 2,
    },
    {
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 19 },
      influenceUncommitted: 3,
      fuelUncommitted: 1,
    },
  ]).toContainEqual(persistedCancelReplaceState)
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.strengthGameId,
    turn: input.playerView.turn,
    submittedActionTargets: { actionId: input.moveThree.id, selectedTargets: null, selectedInputs: null },
  })

  // Both 20 and 30 fit the 50-strength source and the exact 6 Influence / 2 Fuel budget.
  const twentyThirtyGate = createStartGate(2)
  const twentyThirtyResults = await Promise.allSettled([
    submitActionAfterGate(twentyThirtyGate, {
      client: input.player.client,
      submission: {
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.moveOne.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: 20 },
        },
      },
    }),
    submitActionAfterGate(twentyThirtyGate, {
      client: input.player.client,
      submission: {
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.moveTwo.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: 30 },
        },
      },
    }),
  ])
  expect(twentyThirtyResults.every(({ status }) => status === "fulfilled")).toBe(true)
}

export type AssertPersistedCancelReplaceStateInput = {
  moveThreeAfterRace: Action
  afterCancelReplace: PlayerView
  sourceFleet: Fleet
  destination: Planet
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  moveThree: Action
  moveOne: Action
  moveTwo: Action
}

export async function assertMoveOneBeforeDeparture(input: AssertMoveOneBeforeDepartureInput): Promise<void> {
  expect(input.moveOneBeforeDeparture.selectedTargets).toStrictEqual({ fleet: input.sourceFleet.id, planet: input.destination.id })
  expect(input.moveOneBeforeDeparture.selectedInputs).toStrictEqual({ strength: 20 })
  expect(input.moveTwoBeforeDeparture.selectedTargets).toStrictEqual({ fleet: input.sourceFleet.id, planet: input.destination.id })
  expect(input.moveTwoBeforeDeparture.selectedInputs).toStrictEqual({ strength: 30 })
  expect(input.beforeDeparture.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
  expect(input.beforeDeparture.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })

  // Worker reloads both JSON fields from PostgreSQL; full force removes the original source row.
  await processManualDeadlineTurn({ ...input, client: input.player.client, gameId: input.strengthGameId, turn: input.beforeDeparture.turn })
  const afterDeparture = await input.player.client.gameplay.getPlayerView.query({ gameId: input.strengthGameId })
  expect(afterDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  expect(afterDeparture.fleets.some(({ id }) => id === input.sourceFleet.id)).toBe(false)
  expect(afterDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
  const departedStrengths = afterDeparture.fleets.map(({ movement }) => {
    Assert.isDefined(movement)
    const strength = movement.submission.selectedInputs[branded<InputTag>("strength")]
    Assert.isDefined(strength)
    return strength
  })
  expect(departedStrengths.toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  for (const [action, strength] of [
    [input.moveOne, 20],
    [input.moveTwo, 30],
  ] as const) {
    const journey = afterDeparture.fleets.find(({ movement }) => movement?.submission.id === action.id)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({
      strength,
      originPlanetId: input.origin.id,
      destinationPlanetId: input.destination.id,
      distanceToEnd: expect.closeTo(1.04564350459425, 12),
      movement: {
        speed: 0.1,
        departureTurn: input.beforeDeparture.turn,
        pendingArrivalEffects: [],
        submission: {
          id: action.id,
          playerId: input.player.account.id,
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength },
        },
      },
    })
  }
  expect(afterDeparture.actions.find(({ id }) => id === input.moveOne.id)?.isInProgress).toBe(true)
  expect(afterDeparture.actions.find(({ id }) => id === input.moveTwo.id)?.isInProgress).toBe(true)
}

export type AssertMoveOneBeforeDepartureInput = {
  moveOneBeforeDeparture: Action
  sourceFleet: Fleet
  destination: Planet
  moveTwoBeforeDeparture: Action
  beforeDeparture: PlayerView
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  player: AuthenticatedApiClient
  strengthGameId: GameId
  moveOne: Action
  moveTwo: Action
  origin: Planet
}

export async function assertSuccessorView(input: AssertSuccessorViewInput): Promise<void> {
  expect(input.successorView.resources[ResourceType.INFLUENCE].total).toBe(input.expected.influenceTotal)
  expect(normalizeApiDate(input.successorView.turnEndsAt).getTime()).toBeGreaterThan(Clock.now().getTime() + 5_000)

  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.initialView.turn,
      submittedActionTargets: { actionId: input.action.id, selectedTargets: {}, selectedInputs: {} },
    }),
  ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.initialView.turn,
      submittedActionTargets: { actionId: input.action.id, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
}

export type AssertSuccessorViewInput = {
  successorView: PlayerView
  expected:
    | { selectedTargets: null; selectedInputs: null; influenceTotal: number }
    | { selectedTargets: Record<string, never>; selectedInputs: Record<string, never>; influenceTotal: number }
  player: AuthenticatedApiClient
  gameId: GameId
  initialView: PlayerView
  action: Action
}

export async function createClockSetup(input: CreateClockSetupInput): Promise<CreateClockSetupResult> {
  const clock = new ControlledClock({ startDate: Clock.now() })
  const rulesetsRepository = new RulesetsRepository({ db: input.server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(StrengthRaceRuleset))
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(ResourceRaceRuleset))
  const player = await input.server.createClient({ authenticated: true })
  const { createdGameId: strengthGameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: StrengthRaceRuleset.id,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId: strengthGameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.server.database, clock })

  // Build a strength-50 source Fleet using the public API and real PostgreSQL turn persistence.
  let playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
  const origin = playerView.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
  const destination = playerView.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "55:07:50")
  Assert.isDefined(origin)
  Assert.isDefined(destination)

  const updatedVerifyBuildCount = await assertBuildCount({
    playerView,
    player,
    strengthGameId,
    origin,
    clock,
    turnProcessor,
    turnsRepository,
  })
  playerView = updatedVerifyBuildCount.playerView

  const sourceFleet = playerView.fleets[0]
  const moveOne = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
  const moveTwo = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
  const moveThree = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
  Assert.isDefined(sourceFleet)
  Assert.isDefined(moveOne)
  Assert.isDefined(moveTwo)
  Assert.isDefined(moveThree)
  expect(sourceFleet.strength).toBe(50)
  return {
    clock,
    player,
    strengthGameId,
    turnProcessor,
    turnsRepository,
    playerView,
    origin,
    destination,
    sourceFleet,
    moveOne,
    moveTwo,
    moveThree,
  }
}

export type CreateClockSetupInput = { server: ConcurrencyTestApiServer }

export type CreateClockSetupResult = {
  clock: ControlledClock
  player: AuthenticatedApiClient
  strengthGameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  playerView: PlayerView
  origin: Planet
  destination: Planet
  sourceFleet: Fleet
  moveOne: Action
  moveTwo: Action
  moveThree: Action
}

export async function createThirtyStrengthResultsSetup(
  input: CreateThirtyStrengthResultsSetupInput,
): Promise<CreateThirtyStrengthResultsSetupResult> {
  const thirtyStrengthGate = createStartGate(2)
  const thirtyStrengthResults = await Promise.allSettled([
    submitActionAfterGate(thirtyStrengthGate, {
      client: input.player.client,
      submission: {
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.moveOne.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: 30 },
        },
      },
    }),
    submitActionAfterGate(thirtyStrengthGate, {
      client: input.player.client,
      submission: {
        gameId: input.strengthGameId,
        turn: input.playerView.turn,
        submittedActionTargets: {
          actionId: input.moveTwo.id,
          selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
          selectedInputs: { strength: 30 },
        },
      },
    }),
  ])

  // Assert
  expect(thirtyStrengthResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
  expect(thirtyStrengthResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
  const afterThirtyRace = await input.player.client.gameplay.getPlayerView.query({ gameId: input.strengthGameId })
  const firstStrengthAction = afterThirtyRace.actions.find(({ id }) => id === input.moveOne.id)
  const secondStrengthAction = afterThirtyRace.actions.find(({ id }) => id === input.moveTwo.id)
  Assert.isDefined(firstStrengthAction)
  Assert.isDefined(secondStrengthAction)
  const thirtyStrengthSelections = [firstStrengthAction, secondStrengthAction].filter(({ selectedInputs }) => selectedInputs !== null)
  expect(thirtyStrengthSelections).toHaveLength(1)
  expect(thirtyStrengthSelections[0]?.selectedInputs).toStrictEqual({ strength: 30 })
  const expectedThirtyStrengthSelectionByStatus = {
    fulfilled: {
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
      selectedInputs: { strength: 30 },
    },
    rejected: { selectedTargets: null, selectedInputs: null },
  }
  return {
    thirtyStrengthResults,
    afterThirtyRace,
    firstStrengthAction,
    secondStrengthAction,
    thirtyStrengthSelections,
    expectedThirtyStrengthSelectionByStatus,
  }
}

export type CreateThirtyStrengthResultsSetupInput = {
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  moveOne: Action
  sourceFleet: Fleet
  destination: Planet
  moveTwo: Action
}

export type CreateThirtyStrengthResultsSetupResult = {
  thirtyStrengthResults: [PromiseSettledResult<void>, PromiseSettledResult<void>]
  afterThirtyRace: PlayerView
  firstStrengthAction: Action
  secondStrengthAction: Action
  thirtyStrengthSelections: Action[]
  expectedThirtyStrengthSelectionByStatus: {
    fulfilled: { selectedTargets: { fleet: FleetId; planet: PlanetId }; selectedInputs: { strength: number } }
    rejected: { selectedTargets: null; selectedInputs: null }
  }
}

export async function createBeforeDepartureSetup(input: CreateBeforeDepartureSetupInput): Promise<CreateBeforeDepartureSetupResult> {
  expect(input.afterThirtyRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
  expect(input.afterThirtyRace.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
  const sourceAfterThirtyRace = input.afterThirtyRace.fleets.find(({ id }) => id === input.sourceFleet.id)
  const reservedThirtyAction = input.thirtyStrengthSelections[0]
  Assert.isDefined(sourceAfterThirtyRace)
  Assert.isDefined(reservedThirtyAction)
  expect(sourceAfterThirtyRace.strength).toBe(50)
  expect(sourceAfterThirtyRace.strength - 30).toBe(20)

  const selectedThirtyAction = input.thirtyStrengthSelections[0]
  Assert.isDefined(selectedThirtyAction)

  await assertCancelReplaceResults({ ...input, selectedThirtyAction })
  const afterCancelReplace = await input.player.client.gameplay.getPlayerView.query({ gameId: input.strengthGameId })
  const moveThreeAfterRace = afterCancelReplace.actions.find(({ id }) => id === input.moveThree.id)
  Assert.isDefined(moveThreeAfterRace)

  await assertPersistedCancelReplaceState({ ...input, moveThreeAfterRace, afterCancelReplace })
  const beforeDeparture = await input.player.client.gameplay.getPlayerView.query({ gameId: input.strengthGameId })
  const moveOneBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === input.moveOne.id)
  const moveTwoBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === input.moveTwo.id)
  Assert.isDefined(moveOneBeforeDeparture)
  Assert.isDefined(moveTwoBeforeDeparture)
  return { beforeDeparture, moveOneBeforeDeparture, moveTwoBeforeDeparture }
}

export type CreateBeforeDepartureSetupInput = {
  afterThirtyRace: PlayerView
  sourceFleet: Fleet
  thirtyStrengthSelections: Action[]
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  moveThree: Action
  destination: Planet
  moveOne: Action
  moveTwo: Action
}

export type CreateBeforeDepartureSetupResult = {
  beforeDeparture: PlayerView
  moveOneBeforeDeparture: Action
  moveTwoBeforeDeparture: Action
}
