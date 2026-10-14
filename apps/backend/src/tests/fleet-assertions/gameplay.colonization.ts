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

export function assertLoadedJourney2(input: AssertLoadedJourney2Input): void {
  expect(input.loadedJourney).toMatchObject({
    id: input.attackerJourney.id,
    ownerPlayerId: playerIdFor(input.alice),
    strength: 50,
    destinationPlanetId: input.target.id,
    movement: { speed: 1, submission: { id: input.composedActionId } },
  })
  expect(input.loadedJourney.movement?.submission).toMatchObject({
    actionDefinitionId: ComposedSuccessAttackColonize.id,
    selectedTargets: { fleet: input.attacker.id, planet: input.target.id },
    selectedInputs: { strength: 50 },
  })
  expect(input.loadedJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
  expect(
    input.loadedJourney.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
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
  expect(input.arrivalInput.fleets[input.defender.id]).toMatchObject({
    id: input.defender.id,
    ownerPlayerId: playerIdFor(input.bob),
    strength: 10,
  })
  expect(input.arrivalInput.planets[input.target.id]?.ownerPlayerId).toBeNull()
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

export async function assertContinuation2(input: AssertContinuation2Input): Promise<void> {
  expect(input.continuation.actionOutcomes).toHaveLength(4)
  expect(input.continuation.actionOutcomes.every(({ type }) => type === "RESOLVED")).toBe(true)
  expect(input.continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "moved "))).toBe(true)
  expect(input.continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "arrived on Planet"))).toBe(true)
  expect(
    input.continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "exchanged 10 Strength with 10 enemy Strength")),
  ).toBe(true)
  expect(input.continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "colonized Planet"))).toBe(true)
  expect(input.assertContinuationState2Resolved.removedFleetIds).toContain(input.defender.id)
  expect(input.assertContinuationState2Resolved.fleets[input.defender.id]).toBeUndefined()
  expect(input.assertContinuationState2Resolved.fleets[input.attackerJourney.id]).toMatchObject({
    ownerPlayerId: playerIdFor(input.alice),
    originPlanetId: input.target.id,
    strength: 20,
    movement: undefined,
    destinationPlanetId: undefined,
    distanceToEnd: undefined,
  })
  expect(input.assertContinuationState2Resolved.planets[input.target.id]?.ownerPlayerId).toBe(playerIdFor(input.alice))
  expect(input.assertContinuationState2Resolved.planetOwnershipChanges).toStrictEqual([
    { planetId: input.target.id, ownerPlayerId: playerIdFor(input.alice) },
  ])
  expect(input.arrivalReplay.nextRngState).toStrictEqual(input.arrivalInput.rngState)

  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
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

export async function assertReplayedTarget2(input: AssertReplayedTarget2Input): Promise<void> {
  expect(input.replayedTarget?.ownerPlayerId).toBeNull()
  expect(input.assertReplayedTargetState1Resolved.planetOwnershipChanges).toStrictEqual([])
  expect(input.continuation.actionOutcomes).toContainEqual(
    expect.objectContaining({
      type: "RESOLVED",
      result: expect.stringContaining(`exchanged ${input.defenderStrength} Strength with ${input.defenderStrength} enemy Strength`),
    }),
  )
  expect(input.continuation.actionOutcomes.some((outcome) => hasPreventedReason(outcome, input.preventedReason))).toBe(true)
  expect(input.assertReplayedTargetState1Resolved.fleets[input.loadedAttacker.id]?.strength).toBe(input.expectedSurvivingAttackerStrength)
  expect(input.assertReplayedTargetState1Resolved.fleets[input.loadedDefender.id]).toBeUndefined()
  expect(input.assertReplayedTargetState1Resolved.removedFleetIds).toContain(input.loadedDefender.id)
  expect(Object.values(input.assertReplayedTargetState1Resolved.fleets).filter(({ id }) => id === input.loadedAttacker.id)).toHaveLength(
    input.expectedAttackerFleetCount,
  )
  expect(input.assertReplayedTargetState1Resolved.removedFleetIds.filter((id) => id === input.loadedAttacker.id)).toHaveLength(
    input.expectedAttackerRemovalCount,
  )

  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export function assertPersistedNextRngState(input: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.replay.nextRngState)

  logReceipt("[C3-16 public composed prevention receipt]", {
    gameId: input.gameId,
    seed: 1,
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    routes: { attacker: 1.2645395167985714, defender: input.defenderDistance },
    forces: {
      attackerBeforeCombat: input.attackerStrength,
      defenderBeforeCombat: input.defenderStrength,
      attackerAfterCombat: input.expectedSurvivingAttackerStrength,
    },
    action: {
      id: input.composedActionId,
      definitionId: ComposedSuccessAttackColonize.id,
      paidInfluenceOnce: 25,
      pendingTypes: ["FLEET_COLONIZE", "FLEET_ASSAULT"],
    },
    replay: {
      targetOwner: input.replayedTarget?.ownerPlayerId,
      attacker: input.assertPersistedNextRngStatePhase4Value1.fleets[input.loadedAttacker.id]?.strength,
      defenderRemoved: input.assertPersistedNextRngStatePhase4Value1.fleets[input.loadedDefender.id] === undefined,
      outcomes: input.continuation.actionOutcomes.map(describeOutcomeRecord),
    },
    persisted: {
      targetOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      attacker: input.persistedAttacker?.strength,
      defenderRemoved: input.persistedFleetRows.find(({ id }) => id === input.loadedDefender.id) === undefined,
      influence: required(input.views[0]).resources[ResourceType.INFLUENCE],
      colony: required(input.views[0]).resources[ResourceType.COLONY],
      actionReleased: required(input.views[0]).actions.find(({ id }) => id === input.composedActionId)?.isInProgress === false,
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

export function assertRequired(input: AssertRequiredInput): void {
  expect(required(input.selectedViews[0]).actions.find(({ id }) => id === input.moveActionId)).toMatchObject({
    selectedTargets: { fleet: input.aliceStationary.id, planet: input.homeA.id },
    selectedInputs: { strength: 15 },
  })
  expect(required(input.selectedViews[0]).actions.find(({ id }) => id === input.colonizeActionId)).toMatchObject({
    selectedTargets: { fleet: input.aliceStationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  expect(required(input.selectedViews[1]).actions.find(({ id }) => id === input.assaultActionId)).toMatchObject({
    selectedTargets: { station: input.bobAssaultFleet.id, battlePlanet: input.target.id },
    selectedInputs: {},
  })
  expect(required(input.selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 467 })
  expect(required(input.selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
  expect(required(input.selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
  expect(required(input.selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
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

export function assertPersistedJourney(input: AssertPersistedJourneyInput): void {
  expect(input.persistedJourney).toMatchObject({
    strength: 15,
    originPlanetId: input.target.id,
    destinationPlanetId: input.homeA.id,
    movement: { speed: 0.1, submission: { id: input.moveActionId }, pendingArrivalEffects: [] },
  })
  expect(input.persistedJourney.distanceToEnd).toBeCloseTo(input.routeDistance - 0.1, 12)
  expect(required(input.views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 467, uncommitted: 467 })
  expect(required(input.views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
  expect(required(input.views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(required(input.views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
  expect(required(input.views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(required(input.views[0]).actions.find(({ id }) => id === input.colonizeActionId)).toMatchObject({
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

export function assertPersistedNextRngState2(input: AssertPersistedNextRngState2Input): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.replay.nextRngState)

  logReceipt("[C3-19 public stationary post-Move/Assault receipt]", {
    gameId: input.gameId,
    seed: 1,
    target: { id: input.target.id, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    sourceDistance: input.routeDistance,
    stagedForces: { alice35: input.aliceStationary.id, bob1: input.bobAssaultFleet.id },
    selected: { move15: input.moveActionId, stationaryColonize20: input.colonizeActionId, enemyAssault1: input.assaultActionId },
    workerOutcome: {
      owner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      stationaryAfterAssault: 19,
      colonize: input.colonizeResult.actionOutcomes,
      defenderRemoved: true,
    },
    outgoingJourney: {
      id: input.persistedJourney.id,
      strength: input.persistedJourney.strength,
      destination: input.homeA.coordinates,
      remainingDistance: input.persistedJourney.distanceToEnd,
    },
    resourcesAfterUnrefundedCosts: {
      influence: required(input.views[0]).resources[ResourceType.INFLUENCE].total,
      fuel: required(input.views[0]).resources[ResourceType.FUEL].total,
    },
    rng: { preResolution: input.workerInput.rngState, replayNext: input.replay.nextRngState, persistedNext: persistedNextRngState },
  })
}
