import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet, Action, SelectedTargets, SelectedInputs } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { getPlanets, getFleetAt } from "../colonization/gameplay.colonization.scenarios.ts"
import {
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  hasResolvedResult,
  describeOutcome,
  readViews,
} from "../colonization/gameplay.colonization.ts"

export async function assertFinalReplay({
  bobContinuation,
  finalReplay,
  finalWorkerInput,
  turnProcessor,
  views,
  clients,
  gameId,
  target,
  bob,
  stagedAlice,
}: AssertFinalReplayInput): Promise<AssertFinalReplayResult> {
  expect(
    bobContinuation.actionOutcomes.map((outcome) => ({
      type: outcome.type,
      text: describeOutcome(outcome),
    })),
  ).toStrictEqual([
    expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("moved") }),
    expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("arrived on Planet") }),
    expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("exchanged 35 Strength with 35 enemy Strength") }),
    expect.objectContaining({ type: "RESOLVED", text: expect.stringContaining("colonized Planet") }),
  ])
  expect(finalReplay.nextRngState).toStrictEqual(finalWorkerInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  views = await readViews(clients, gameId)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(bob))
  expect(required(views[0]).fleets.some(({ id }) => id === stagedAlice.id)).toBe(false)
  expect(getFleetAt(required(views[1]), playerIdFor(bob), target.id, 15)).toBeDefined()
  expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0, 0])
  expect(required(views[0]).resources[ResourceType.INFLUENCE].total).toBe(470)
  expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(493)
  expect(required(views[0]).resources[ResourceType.FUEL].total).toBe(95)
  expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(99)

  return { views }
}

export type AssertFinalReplayInput = {
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  finalWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  target: Planet
  bob: AuthenticatedApiClient
  stagedAlice: Fleet
}

export type AssertFinalReplayResult = { views: PlayerView[] }

export function assertPersistedNextRngState(input: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.finalReplay.nextRngState)

  logReceipt("[C3-08 public dead-earlier Assault receipt]", {
    gameId: input.gameId,
    seed: 1,
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    routes: { aliceDistance: input.aliceDistance, bobDistance: input.bobDistance },
    aliceTickZeroFleet: { id: input.stagedAlice.id, forceBeforeAssault: 35, removedAfterAssault: true },
    bobJourney: { id: input.bobJourney.id, forceBeforeAssault: 70, actualArrivalTick: 3, finalClaimingForce: 15 },
    assaultOutcome: input.bobContinuation.actionOutcomes.find((outcome) => hasResolvedResult(outcome, "exchanged 35 Strength")),
    aliceColonizeOutcome: input.assertPersistedNextRngStatePhase2Value1.resolvedActions.find(
      ({ submittedAction }) => submittedAction.id === input.aliceColonizeActionId,
    )?.actionOutcomes,
    winner: playerIdFor(input.bob),
    preResolutionRngState: input.finalWorkerInput.rngState,
    persistedNextRngState,
    persistedResources: input.views.map(({ player, resources }) => ({
      playerId: player.id,
      influence: resources[ResourceType.INFLUENCE].total,
      fuel: resources[ResourceType.FUEL].total,
      colony: resources[ResourceType.COLONY].total,
    })),
  })
}

export type AssertPersistedNextRngStateInput = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: GameId
  target: Planet
  aliceDistance: number
  bobDistance: number
  stagedAlice: Fleet
  bobJourney: Fleet
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  assertPersistedNextRngStatePhase2Value1: ResolvedTurnState
  aliceColonizeActionId: string
  bob: AuthenticatedApiClient
  finalWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  views: PlayerView[]
}

export type AssertPersistedNextRngState2Input = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  gameId: number
  views: PlayerView[]
  homeA: Planet
  target: Planet
  stagedFriendly: Fleet
  persistedFriendlyFleets: Fleet[]
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  bobStageActionId: string
  aliceStageActionId: string
}

export type AssertPersistedNextRngState3Input = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  gameId: number
  views: PlayerView[]
  homeA: Planet
  target: Planet
  stagedFriendly: Fleet
  speed4ActionId: string
  speed2ActionId: string
  mergedFriendly: ResolutionFleet
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  reversedReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
}

export function assertPersistedNextRngState2(input: AssertPersistedNextRngState2Input): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.finalTurnInput.rngState)
  logReceipt("[C3-12 public provenance receipt]", {
    gameId: input.gameId,
    seed: 1,
    players: [required(input.views[0]).player.id, required(input.views[1]).player.id],
    source: { id: input.homeA.id, name: input.homeA.name, coordinates: input.homeA.coordinates },
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    sourceToTargetDistance: 1.2645395167985714,
    bobHomeToSourceDistance: 20.111265402761585,
    staging: {
      ordinaryFriendly: { strength: 10, speed: 5, arrivalTick: 6, fleetId: input.stagedFriendly.id, fleetName: input.stagedFriendly.name },
      bobToSource: {
        strength: 35,
        speed: 5,
        remainingDistances: [15.111265402761585, 10.111265402761585, 5.111265402761585, 0.111265402761585],
        arrivalTick: 1,
      },
    },
    observation: {
      ordinaryFriendly: { strength: 10, speed: 10, tick: 3 },
      bobColonize: { strength: 35, speed: 4, tick: 7 },
      aliceColonize: { strength: 20, speed: 2, tick: 13 },
      aliceSourceRemainder: 20,
    },
    persistedOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    persistedFriendly: input.persistedFriendlyFleets,
    persistedEnemy: required(input.views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(input.views[1]).player.id, originPlanetId: input.target.id }),
    ),
    loadedRngState: input.finalTurnInput.rngState,
    replayNextRngState: input.finalReplay.nextRngState,
    persistedNextRngState,
    actualWorkerLoadedTurn: input.finalTurnInput.turn,
    stagedBobSubmissionId: input.bobStageActionId,
    stagedAliceSubmissionId: input.aliceStageActionId,
  })
}

export async function assertLaterReplay({
  assertLaterReplayPhase4Value1,
  target,
  views,
  bobJourneyId,
  bobColonizeActionId,
  laterReplay,
  laterTurnInput,
  turnProcessor,
  clients,
  gameId,
  stagedFriendly,
  ordinaryActionId,
}: AssertLaterReplayInput): Promise<AssertLaterReplayResult> {
  expect(assertLaterReplayPhase4Value1.planets[target.id]?.ownerPlayerId).toBe(required(views[0]).player.id)
  expect(assertLaterReplayPhase4Value1.fleets[bobJourneyId]).toMatchObject({
    id: bobJourneyId,
    ownerPlayerId: required(views[1]).player.id,
    originPlanetId: target.id,
    strength: 35,
    arrivedAtTick: 6,
  })
  expect(
    assertLaterReplayPhase4Value1.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobColonizeActionId,
    )?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
  expect(laterReplay.nextRngState).toStrictEqual(laterTurnInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  views = await readViews(clients, gameId)

  assertGetPlanets({ views, target, stagedFriendly, ordinaryActionId, bobColonizeActionId })

  return { views }
}

export type AssertLaterReplayInput = {
  assertLaterReplayPhase4Value1: ResolvedTurnState
  target: Planet
  views: PlayerView[]
  bobJourneyId: FleetId
  bobColonizeActionId: string
  laterReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  laterTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  stagedFriendly: Fleet
  ordinaryActionId: string
}

export type AssertLaterReplayResult = { views: PlayerView[] }

export function assertGetPlanets(input: AssertGetPlanetsInput): void {
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBe(
    required(input.views[0]).player.id,
  )
  expect(getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.target.id, 20)).toMatchObject({
    id: input.stagedFriendly.id,
    name: input.stagedFriendly.name,
  })
  expect(getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.target.id, 35)).toBeDefined()
  expect(required(input.views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
  expect(required(input.views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
  expect(required(input.views[0]).actions.find(({ id }) => id === input.ordinaryActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(required(input.views[1]).actions.find(({ id }) => id === input.bobColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}

export type AssertGetPlanetsInput = {
  views: PlayerView[]
  target: Planet
  stagedFriendly: Fleet
  ordinaryActionId: string
  bobColonizeActionId: string
}

export async function assertMergedFriendly({
  mergedFriendly,
  stagedFriendly,
  selectedViews,
  target,
  publicReplay,
  aliceSource,
  homeA,
  turnProcessor,
  views,
  clients,
  gameId,
  speed4ActionId,
  speed2ActionId,
}: AssertMergedFriendlyInput): Promise<AssertMergedFriendlyResult> {
  expect(mergedFriendly).toMatchObject({
    id: stagedFriendly.id,
    name: stagedFriendly.name,
    ownerPlayerId: required(selectedViews[0]).player.id,
    originPlanetId: target.id,
    strength: 30,
  })
  expect(publicReplay.fleets[aliceSource.id]).toMatchObject({
    id: aliceSource.id,
    originPlanetId: homeA.id,
    strength: 10,
  })
  expect(publicReplay.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  views = await readViews(clients, gameId)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
  expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 30)).toMatchObject({
    id: stagedFriendly.id,
    name: stagedFriendly.name,
  })
  expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)).toMatchObject({ id: aliceSource.id, strength: 10 })
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 443, uncommitted: 443 })
  expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
  for (const actionId of [speed4ActionId, speed2ActionId]) {
    expect(required(views[0]).actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  }

  return { views }
}

export type AssertMergedFriendlyInput = {
  mergedFriendly: ResolutionFleet
  stagedFriendly: Fleet
  selectedViews: PlayerView[]
  target: Planet
  publicReplay: ResolvedTurnState
  aliceSource: Fleet
  homeA: Planet
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  speed4ActionId: string
  speed2ActionId: string
}

export type AssertMergedFriendlyResult = { views: PlayerView[] }

export function assertPersistedNextRngState3(input: AssertPersistedNextRngState3Input): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.finalTurnInput.rngState)
  logReceipt("[C3-13 public duplicate receipt]", {
    gameId: input.gameId,
    seed: 1,
    players: [required(input.views[0]).player.id, required(input.views[1]).player.id],
    source: { id: input.homeA.id, name: input.homeA.name, coordinates: input.homeA.coordinates },
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    routeDistance: 1.2645395167985714,
    sourceRemainder: 10,
    stagedFleet: { id: input.stagedFriendly.id, name: input.stagedFriendly.name, strength: 10, arrivalTick: 6 },
    arrivals: [
      { actionId: input.speed4ActionId, strength: 20, speed: 4, arrivalTick: 7, outcome: "RESOLVED" },
      { actionId: input.speed2ActionId, strength: 20, speed: 2, arrivalTick: 13, outcome: "PREVENTED" },
    ],
    finalFleet: input.mergedFriendly,
    influence: { before: 493, committed: 50, after: 443 },
    loadedRngState: input.finalTurnInput.rngState,
    replayNextRngState: input.finalReplay.nextRngState,
    reversedReplayNextRngState: input.reversedReplay.nextRngState,
    persistedNextRngState,
    actualWorkerLoadedTurn: input.finalTurnInput.turn,
  })
}

export async function assertRaceObservation({
  selectedMove,
  selectedColonize,
  beforeClosure,
  winningAction,
  stationary,
  homeA,
  arrivedView,
  moveAction,
  target,
  colonizeAction,
  alice,
  gameId,
  bob,
  selectedView,
}: AssertRaceObservationInput): Promise<AssertRaceObservationResult> {
  const raceObservation = {
    move: { selectedTargets: selectedMove.selectedTargets, selectedInputs: selectedMove.selectedInputs },
    colonize: { selectedTargets: selectedColonize.selectedTargets, selectedInputs: selectedColonize.selectedInputs },
    influenceUncommitted: beforeClosure.influence.uncommitted,
    fuelUncommitted: beforeClosure.fuel.uncommitted,
    winningActionId: winningAction.id,
  }

  assertScenarioState({ stationary, homeA, arrivedView, moveAction, target, colonizeAction, raceObservation })
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: arrivedView.turn,
    submittedActionTargets: { actionId: winningAction.id, selectedTargets: null, selectedInputs: null },
  })
  const clearedViews = await readViews([alice, bob], gameId)
  selectedView = required(clearedViews[0])

  return { selectedView }
}

export type AssertRaceObservationInput = {
  selectedMove: Action
  selectedColonize: Action
  beforeClosure: { influence: { uncommitted: number; total: number }; fuel: { uncommitted: number; total: number } }
  winningAction: Action
  stationary: Fleet
  homeA: Planet
  arrivedView: PlayerView
  moveAction: Action
  target: Planet
  colonizeAction: Action
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  selectedView: PlayerView
}

export type AssertRaceObservationResult = { selectedView: PlayerView }

export function assertScenarioState(input: AssertScenarioStateInput): void {
  expect([
    {
      move: { selectedTargets: { fleet: input.stationary.id, planet: input.homeA.id }, selectedInputs: { strength: 16 } },
      colonize: { selectedTargets: null, selectedInputs: null },
      influenceUncommitted: input.arrivedView.resources[ResourceType.INFLUENCE].total - 3,
      fuelUncommitted: input.arrivedView.resources[ResourceType.FUEL].total - 1,
      winningActionId: input.moveAction.id,
    },
    {
      move: { selectedTargets: null, selectedInputs: null },
      colonize: { selectedTargets: { fleet: input.stationary.id, planet: input.target.id }, selectedInputs: {} },
      influenceUncommitted: input.arrivedView.resources[ResourceType.INFLUENCE].total - 25,
      fuelUncommitted: input.arrivedView.resources[ResourceType.FUEL].total,
      winningActionId: input.colonizeAction.id,
    },
  ]).toContainEqual(input.raceObservation)
}

export type AssertScenarioStateInput = {
  stationary: Fleet
  homeA: Planet
  arrivedView: PlayerView
  moveAction: Action
  target: Planet
  colonizeAction: Action
  raceObservation: {
    move: { selectedTargets: SelectedTargets; selectedInputs: SelectedInputs }
    colonize: { selectedTargets: SelectedTargets; selectedInputs: SelectedInputs }
    influenceUncommitted: number
    fuelUncommitted: number
    winningActionId: ActionId
  }
}

export type AssertScenarioState2Input = {
  completedView: PlayerView
  selectedView: PlayerView
  completedObservation: {
    closureSubmissionStatus: "rejected" | "fulfilled"
    ownerPlayerId: null | PlayerId
    remainingStrength: undefined | number
    influence: number
  }
  closureColonize: Action
}
