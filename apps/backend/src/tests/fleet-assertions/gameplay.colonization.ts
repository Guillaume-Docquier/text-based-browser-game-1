import type { NonNegativeNumber, PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import type { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import type { PendingArrivalEffect } from "shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { FleetName } from "shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionPlanet } from "shared/turn-resolution/state/ResolutionPlanet.ts"
import { expect } from "vitest"
import type { Fleet, Planet, PlayerView } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { getPlanets, getFleetAt } from "../colonization/gameplay.colonization.scenarios.ts"
import {
  ComposedSuccessAttackColonize,
  logReceipt,
  required,
  playerIdFor,
  hasResolvedResult,
  hasPreventedReason,
  describeOutcomeRecord,
  readViews,
} from "../colonization/gameplay.colonization.ts"

export function assertLoadedJourney2({
  loadedJourney,
  attackerJourney,
  alice,
  target,
  composedActionId,
  attacker,
  arrivalInput,
  defender,
  bob,
}: AssertLoadedJourney2Input): void {
  expect(loadedJourney).toMatchObject({
    id: attackerJourney.id,
    ownerPlayerId: playerIdFor(alice),
    strength: 50,
    destinationPlanetId: target.id,
    movement: { speed: 1, submission: { id: composedActionId } },
  })
  expect(loadedJourney.movement?.submission).toMatchObject({
    actionDefinitionId: ComposedSuccessAttackColonize.id,
    selectedTargets: { fleet: attacker.id, planet: target.id },
    selectedInputs: { strength: 50 },
  })
  expect(loadedJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(
    loadedJourney.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
      type: effectDefinition.type,
      definitionOrdinal,
      targets: effectDefinition.targets,
    })),
  ).toStrictEqual([
    {
      type: "FLEET_COLONIZE",
      definitionOrdinal: 1,
      targets: {
        fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
        planet: { actionTargetTag: "planet", targetType: "PLANET" },
      },
    },
    {
      type: "FLEET_ASSAULT",
      definitionOrdinal: 2,
      targets: {
        fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
        planet: { actionTargetTag: "planet", targetType: "PLANET" },
      },
    },
  ])
  expect(arrivalInput.fleets[defender.id]).toMatchObject({ id: defender.id, ownerPlayerId: playerIdFor(bob), strength: 10 })
  expect(arrivalInput.planets[target.id]?.ownerPlayerId).toBeNull()
}

export type AssertLoadedJourney2Input = {
  loadedJourney: ReturnType<typeof createFleetStub>
  attackerJourney: Fleet
  alice: AuthenticatedApiClient
  target: Planet
  composedActionId: string
  attacker: Fleet
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
  defender: Fleet
  bob: AuthenticatedApiClient
}

export async function assertContinuation({
  assertAssertContinuationState2ResolvedPhase2Value1,
  continuation,
  defender,
  attackerJourney,
  alice,
  target,
  arrivalReplay,
  arrivalInput,
  turnProcessor,
  views,
  clients,
  gameId,
  arrivalTurn,
  composedActionId,
}: AssertContinuationInput): Promise<AssertContinuationResult> {
  const assertContinuationState2Resolved = assertAssertContinuationState2ResolvedPhase2Value1

  await assertContinuation2({
    continuation,
    assertContinuationState2Resolved,
    defender,
    attackerJourney,
    alice,
    target,
    arrivalReplay,
    arrivalInput,
    turnProcessor,
  })
  views = await readViews(clients, gameId)
  expect(required(views[0]).turn).toBe(arrivalTurn + 1)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
  expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 20).id).toBe(attackerJourney.id)
  expect(required(views[1]).fleets.find(({ id }) => id === defender.id)).toBeUndefined()
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 473, uncommitted: 473 })
  expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(required(views[0]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
  expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(required(views[1]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })

  return { views }
}

export type AssertContinuationInput = {
  assertAssertContinuationState2ResolvedPhase2Value1: ResolvedTurnState
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  defender: Fleet
  attackerJourney: Fleet
  alice: AuthenticatedApiClient
  target: Planet
  arrivalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  arrivalTurn: number
  composedActionId: string
}

export type AssertContinuationResult = { views: PlayerView[] }

export type AssertContinuation2Input = {
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  assertContinuationState2Resolved: ResolvedTurnState
  defender: Fleet
  attackerJourney: Fleet
  alice: AuthenticatedApiClient
  target: Planet
  arrivalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export async function assertContinuation2({
  continuation,
  assertContinuationState2Resolved,
  defender,
  attackerJourney,
  alice,
  target,
  arrivalReplay,
  arrivalInput,
  turnProcessor,
}: AssertContinuation2Input): Promise<void> {
  expect(continuation.actionOutcomes).toHaveLength(4)
  expect(continuation.actionOutcomes.every(({ type }) => type === "RESOLVED")).toBe(true)
  expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "moved "))).toBe(true)
  expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "arrived on Planet"))).toBe(true)
  expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "exchanged 10 Strength with 10 enemy Strength"))).toBe(
    true,
  )
  expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "colonized Planet"))).toBe(true)
  expect(assertContinuationState2Resolved.removedFleetIds).toContain(defender.id)
  expect(assertContinuationState2Resolved.fleets[defender.id]).toBeUndefined()
  expect(assertContinuationState2Resolved.fleets[attackerJourney.id]).toMatchObject({
    ownerPlayerId: playerIdFor(alice),
    originPlanetId: target.id,
    strength: 20,
    movement: undefined,
    destinationPlanetId: undefined,
    distanceToEnd: undefined,
  })
  expect(assertContinuationState2Resolved.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(alice))
  expect(assertContinuationState2Resolved.planetOwnershipChanges).toStrictEqual([
    { planetId: target.id, ownerPlayerId: playerIdFor(alice) },
  ])
  expect(arrivalReplay.nextRngState).toStrictEqual(arrivalInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertReplayedTarget({
  assertAssertReplayedTargetState1ResolvedPhase3Value1,
  replayedTarget,
  continuation,
  defenderStrength,
  preventedReason,
  loadedAttacker,
  expectedSurvivingAttackerStrength,
  loadedDefender,
  expectedAttackerFleetCount,
  expectedAttackerRemovalCount,
  turnProcessor,
  views,
  clients,
  gameId,
  target,
}: AssertReplayedTargetInput): Promise<AssertReplayedTargetResult> {
  const assertReplayedTargetState1Resolved = assertAssertReplayedTargetState1ResolvedPhase3Value1

  await assertReplayedTarget2({
    replayedTarget,
    assertReplayedTargetState1Resolved,
    continuation,
    defenderStrength,
    preventedReason,
    loadedAttacker,
    expectedSurvivingAttackerStrength,
    loadedDefender,
    expectedAttackerFleetCount,
    expectedAttackerRemovalCount,
    turnProcessor,
  })
  views = await readViews(clients, gameId)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(required(views[0]).fleets.find(({ id }) => id === loadedDefender.id)).toBeUndefined()

  return { views }
}

export type AssertReplayedTargetInput = {
  assertAssertReplayedTargetState1ResolvedPhase3Value1: ResolvedTurnState
  replayedTarget: undefined | ResolutionPlanet
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  defenderStrength: number
  preventedReason: string
  loadedAttacker: ReturnType<typeof createFleetStub>
  expectedSurvivingAttackerStrength: undefined | number
  loadedDefender: ReturnType<typeof createFleetStub>
  expectedAttackerFleetCount: number
  expectedAttackerRemovalCount: number
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  target: Planet
}

export type AssertReplayedTargetResult = { views: PlayerView[] }

export type AssertReplayedTarget2Input = {
  replayedTarget: undefined | ResolutionPlanet
  assertReplayedTargetState1Resolved: ResolvedTurnState
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  defenderStrength: number
  preventedReason: string
  loadedAttacker: ReturnType<typeof createFleetStub>
  expectedSurvivingAttackerStrength: undefined | number
  loadedDefender: ReturnType<typeof createFleetStub>
  expectedAttackerFleetCount: number
  expectedAttackerRemovalCount: number
  turnProcessor: TurnProcessor
}

export async function assertReplayedTarget2({
  replayedTarget,
  assertReplayedTargetState1Resolved,
  continuation,
  defenderStrength,
  preventedReason,
  loadedAttacker,
  expectedSurvivingAttackerStrength,
  loadedDefender,
  expectedAttackerFleetCount,
  expectedAttackerRemovalCount,
  turnProcessor,
}: AssertReplayedTarget2Input): Promise<void> {
  expect(replayedTarget?.ownerPlayerId).toBeNull()
  expect(assertReplayedTargetState1Resolved.planetOwnershipChanges).toStrictEqual([])
  expect(continuation.actionOutcomes).toContainEqual(
    expect.objectContaining({
      type: "RESOLVED",
      result: expect.stringContaining(`exchanged ${defenderStrength} Strength with ${defenderStrength} enemy Strength`),
    }),
  )
  expect(continuation.actionOutcomes.some((outcome) => hasPreventedReason(outcome, preventedReason))).toBe(true)
  expect(assertReplayedTargetState1Resolved.fleets[loadedAttacker.id]?.strength).toBe(expectedSurvivingAttackerStrength)
  expect(assertReplayedTargetState1Resolved.fleets[loadedDefender.id]).toBeUndefined()
  expect(assertReplayedTargetState1Resolved.removedFleetIds).toContain(loadedDefender.id)
  expect(Object.values(assertReplayedTargetState1Resolved.fleets).filter(({ id }) => id === loadedAttacker.id)).toHaveLength(
    expectedAttackerFleetCount,
  )
  expect(assertReplayedTargetState1Resolved.removedFleetIds.filter((id) => id === loadedAttacker.id)).toHaveLength(
    expectedAttackerRemovalCount,
  )

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export function assertPersistedNextRngState({
  savedNextTurn,
  replay,
  gameId,
  target,
  defenderDistance,
  attackerStrength,
  defenderStrength,
  expectedSurvivingAttackerStrength,
  composedActionId,
  replayedTarget,
  assertPersistedNextRngStatePhase4Value1,
  loadedAttacker,
  loadedDefender,
  continuation,
  views,
  persistedAttacker,
  persistedFleetRows,
}: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

  logReceipt("[C3-16 public composed prevention receipt]", {
    gameId,
    seed: 1,
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    routes: { attacker: 1.2645395167985714, defender: defenderDistance },
    forces: {
      attackerBeforeCombat: attackerStrength,
      defenderBeforeCombat: defenderStrength,
      attackerAfterCombat: expectedSurvivingAttackerStrength,
    },
    action: {
      id: composedActionId,
      definitionId: ComposedSuccessAttackColonize.id,
      paidInfluenceOnce: 25,
      pendingTypes: ["FLEET_COLONIZE", "FLEET_ASSAULT"],
    },
    replay: {
      targetOwner: replayedTarget?.ownerPlayerId,
      attacker: assertPersistedNextRngStatePhase4Value1.fleets[loadedAttacker.id]?.strength,
      defenderRemoved: assertPersistedNextRngStatePhase4Value1.fleets[loadedDefender.id] === undefined,
      outcomes: continuation.actionOutcomes.map(describeOutcomeRecord),
    },
    persisted: {
      targetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      attacker: persistedAttacker?.strength,
      defenderRemoved: persistedFleetRows.find(({ id }) => id === loadedDefender.id) === undefined,
      influence: required(views[0]).resources[ResourceType.INFLUENCE],
      colony: required(views[0]).resources[ResourceType.COLONY],
      actionReleased: required(views[0]).actions.find(({ id }) => id === composedActionId)?.isInProgress === false,
      persistedNextRngState,
    },
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
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: number
  target: Planet
  defenderDistance: number
  attackerStrength: number
  defenderStrength: number
  expectedSurvivingAttackerStrength: undefined | number
  composedActionId: string
  replayedTarget: undefined | ResolutionPlanet
  assertPersistedNextRngStatePhase4Value1: ResolvedTurnState
  loadedAttacker: ReturnType<typeof createFleetStub>
  loadedDefender: ReturnType<typeof createFleetStub>
  continuation: ResolvedTurnState["resolvedContinuations"][number]
  views: PlayerView[]
  persistedAttacker: undefined | Fleet
  persistedFleetRows: Array<{
    id: FleetId
    gameId: GameId
    ownerPlayerId: PlayerId
    name: FleetName
    strength: number
    originPlanetId: PlanetId
    destinationPlanetId: null | PlanetId
    distanceToEnd: null | NonNegativeNumber
    movement: null | Readonly<{
      speed: PositiveNumber
      departureTurn: PositiveInteger
      submission: ReturnType<typeof createSubmittedActionStub>
      pendingArrivalEffects: readonly PendingArrivalEffect[]
    }>
  }>
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
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: number
  target: Planet
  routeDistance: number
  aliceStationary: Fleet
  bobAssaultFleet: Fleet
  moveActionId: string
  colonizeActionId: string
  assaultActionId: string
  views: PlayerView[]
  colonizeResult: Readonly<{ submittedAction: ReturnType<typeof createSubmittedActionStub>; actionOutcomes: readonly EffectOutcome[] }>
  persistedJourney: Fleet
  homeA: Planet
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

export function assertRequired({
  selectedViews,
  moveActionId,
  aliceStationary,
  homeA,
  colonizeActionId,
  target,
  assaultActionId,
  bobAssaultFleet,
}: AssertRequiredInput): void {
  expect(required(selectedViews[0]).actions.find(({ id }) => id === moveActionId)).toMatchObject({
    selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
    selectedInputs: { strength: 15 },
  })
  expect(required(selectedViews[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    selectedTargets: { fleet: aliceStationary.id, planet: target.id },
    selectedInputs: {},
  })
  expect(required(selectedViews[1]).actions.find(({ id }) => id === assaultActionId)).toMatchObject({
    selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
    selectedInputs: {},
  })
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 467 })
  expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
  expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
  expect(required(selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
}

export type AssertRequiredInput = {
  selectedViews: PlayerView[]
  moveActionId: string
  aliceStationary: Fleet
  homeA: Planet
  colonizeActionId: string
  target: Planet
  assaultActionId: string
  bobAssaultFleet: Fleet
}

export function assertPersistedJourney({
  persistedJourney,
  target,
  homeA,
  moveActionId,
  routeDistance,
  views,
  colonizeActionId,
}: AssertPersistedJourneyInput): void {
  expect(persistedJourney).toMatchObject({
    strength: 15,
    originPlanetId: target.id,
    destinationPlanetId: homeA.id,
    movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
  })
  expect(persistedJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 467, uncommitted: 467 })
  expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
  expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
  expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(required(views[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}

export type AssertPersistedJourneyInput = {
  persistedJourney: Fleet
  target: Planet
  homeA: Planet
  moveActionId: string
  routeDistance: number
  views: PlayerView[]
  colonizeActionId: string
}

export function assertPersistedNextRngState2({
  savedNextTurn,
  replay,
  gameId,
  target,
  routeDistance,
  aliceStationary,
  bobAssaultFleet,
  moveActionId,
  colonizeActionId,
  assaultActionId,
  views,
  colonizeResult,
  persistedJourney,
  homeA,
  workerInput,
}: AssertPersistedNextRngState2Input): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

  logReceipt("[C3-19 public stationary post-Move/Assault receipt]", {
    gameId,
    seed: 1,
    target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
    sourceDistance: routeDistance,
    stagedForces: { alice35: aliceStationary.id, bob1: bobAssaultFleet.id },
    selected: { move15: moveActionId, stationaryColonize20: colonizeActionId, enemyAssault1: assaultActionId },
    workerOutcome: {
      owner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      stationaryAfterAssault: 19,
      colonize: colonizeResult.actionOutcomes,
      defenderRemoved: true,
    },
    outgoingJourney: {
      id: persistedJourney.id,
      strength: persistedJourney.strength,
      destination: homeA.coordinates,
      remainingDistance: persistedJourney.distanceToEnd,
    },
    resourcesAfterUnrefundedCosts: {
      influence: required(views[0]).resources[ResourceType.INFLUENCE].total,
      fuel: required(views[0]).resources[ResourceType.FUEL].total,
    },
    rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
  })
}
