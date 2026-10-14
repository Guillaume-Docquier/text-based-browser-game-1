import { mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import type { PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import { expect } from "vitest"
import { evaluateActionSelection } from "#shared/action-submission/evaluateActionSelection.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { AssertTurnTwoJourneys2Input } from "./fleet-colonization.assertions.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  createFleetSelectionDraft,
  findJourneyForSubmission,
  findResolvedContinuation,
  outcomeText,
  resolveContinuation,
  submit,
} from "./fleet-colonization.test-support.ts"

export function assertTurnTwoJourneys2({
  turnTwoJourneys,
  preCombatState,
  cAttackJourney,
  p,
  preCombatContext,
  attackActionId,
  strengthTotal,
  turnTwo,
  departure,
}: AssertTurnTwoJourneys2Input): void {
  expect(turnTwoJourneys.map(({ id }) => preCombatState.fleets[id]?.arrivedAtTick)).toStrictEqual([5, 10, 10, 8])
  expect(preCombatState.fleets[cAttackJourney.id]).toMatchObject({
    id: cAttackJourney.id,
    ownerPlayerId: PLAYER_C,
    originPlanetId: p.id,
    strength: 16,
    arrivedAtTick: 8,
  })
  expect(
    preCombatContext.pendingArrivalAssaults.map(({ initiatingJourneyId, actualFleetId, planetId, tick }) => ({
      initiatingJourneyId,
      actualFleetId,
      planetId,
      tick,
    })),
  ).toStrictEqual([{ initiatingJourneyId: cAttackJourney.id, actualFleetId: cAttackJourney.id, planetId: p.id, tick: 8 }])
  expect(findResolvedContinuation(preCombatContext, PLAYER_C, attackActionId).actionOutcomes.map(outcomeText)).toStrictEqual([
    'Fleet "i4-c-source" moved 0.75 light years towards Planet "i4-destination-p"',
    'Fleet "i4-c-source" arrived on Planet "i4-destination-p"',
  ])
  expect(strengthTotal(turnTwo)).toBe(121)
  expect(turnTwo.players[PLAYER_A]?.resources).toStrictEqual(departure.players[PLAYER_A]?.resources)
  expect(turnTwo.players[PLAYER_B]?.resources).toStrictEqual(departure.players[PLAYER_B]?.resources)
  expect(turnTwo.players[PLAYER_C]?.resources).toStrictEqual(departure.players[PLAYER_C]?.resources)
}

export function assertAAtP2({
  aAtP,
  aAtQ,
  bAtP,
  afterArrival,
  p,
  q,
  cAttackJourney,
  strengthTotal,
  colonizeActionId,
  moveActionId,
  attackActionId,
  aColonizeJourney,
  bColonizeJourney,
}: AssertAAtP2Input): void {
  expect(aAtP).toMatchObject({ strength: 7, arrivedAtTick: 5 })
  expect(aAtQ).toMatchObject({ strength: 15, arrivedAtTick: 10 })
  expect(bAtP).toMatchObject({ strength: 27, arrivedAtTick: 10 })
  expect(afterArrival.planets[p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(afterArrival.planets[q.id]?.ownerPlayerId).toBeNull()
  expect(Object.values(afterArrival.fleets).some(({ ownerPlayerId }) => ownerPlayerId === PLAYER_C)).toBe(false)
  expect(afterArrival.removedFleetIds).toContain(cAttackJourney.id)
  expect(strengthTotal(afterArrival)).toBe(69)
  expect(afterArrival.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 72,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
  expect(afterArrival.players[PLAYER_B]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 75,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 7,
  })
  expect(afterArrival.players[PLAYER_C]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 95,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
  expect(findResolvedContinuation(afterArrival, PLAYER_A, colonizeActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("colonized Planet"),
  })
  expect(findResolvedContinuation(afterArrival, PLAYER_A, moveActionId).actionOutcomes.map(outcomeText).join(" ")).not.toContain(
    "exchanged",
  )
  expect(findResolvedContinuation(afterArrival, PLAYER_B, colonizeActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
  })
  expect(findResolvedContinuation(afterArrival, PLAYER_C, attackActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("exchanged 16 Strength with 70 enemy Strength"),
  })
  expect([aColonizeJourney.strength, bColonizeJourney.strength]).toStrictEqual([35, 35])
  expect([aAtP.strength, bAtP.strength]).toStrictEqual([7, 27])
  expect(aColonizeJourney.strength - aAtP.strength).toBe(28)
  expect(bColonizeJourney.strength - bAtP.strength).toBe(8)
}

export type AssertAAtP2Input = {
  aAtP: ReturnType<typeof createFleetStub>
  aAtQ: ReturnType<typeof createFleetStub>
  bAtP: ReturnType<typeof createFleetStub>
  afterArrival: ResolvedTurnState
  p: ReturnType<typeof createPlanetStub>
  q: ReturnType<typeof createPlanetStub>
  cAttackJourney: ReturnType<typeof createFleetStub>
  strengthTotal: (state: ResolvedTurnState) => number
  colonizeActionId: ActionId
  moveActionId: ActionId
  attackActionId: ActionId
  aColonizeJourney: ReturnType<typeof createFleetStub>
  bColonizeJourney: ReturnType<typeof createFleetStub>
}

export function assertAAtP({
  aAtP,
  bAtP,
  aAtQ,
  aAtHome,
  eligibilityState,
  afterArrival,
  journeyActionBindings,
  ruleset,
  moveActionId,
  aSource,
  q,
  ordinaryMove,
  turnThreeRng,
  reloadTurn,
  p,
  strengthTotal,
}: AssertAAtPInput): void {
  expect(aAtP.strength + bAtP.strength + aAtQ.strength + aAtHome.strength).toBe(69)

  const aTurnFour = eligibilityState(
    PLAYER_A,
    4,
    afterArrival.players,
    Object.values(afterArrival.planets),
    Object.values(afterArrival.fleets),
  )

  verifyReleased({ journeyActionBindings, eligibilityState, afterArrival, ruleset, aTurnFour, moveActionId, aSource, q })

  verifyReuseSubmission({ moveActionId, ordinaryMove, aSource, q, turnThreeRng, reloadTurn, afterArrival, p, bAtP, strengthTotal })
}

export type AssertAAtPInput = {
  aAtP: ReturnType<typeof createFleetStub>
  bAtP: ReturnType<typeof createFleetStub>
  aAtQ: ReturnType<typeof createFleetStub>
  aAtHome: ResolutionFleet
  eligibilityState: EligibilityStateCallback
  afterArrival: ResolvedTurnState
  journeyActionBindings: Array<{ playerId: PlayerId; actionId: ActionId; freeMoveActionId: ActionId }>
  ruleset: Ruleset
  moveActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  q: ReturnType<typeof createPlanetStub>
  ordinaryMove: {
    id: ActionDefinitionId
    name: string
    type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
    tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
    inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
    targets: Record<
      TargetTag,
      {
        targetType: "FLEET" | "PLANET" | "PLAYER"
        constraints: ReadonlyArray<
          | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
          | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
          | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
          | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
          | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
          | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
        >
      }
    >
    costs: Array<{
      type: "RESOURCE_LOSS"
      targets: Record<string, never>
      parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
    }>
    effects: Array<
      | {
          type: "RESOURCE_LOSS"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | {
          type: "RESOURCE_GAIN"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
      | { type: "FLEET_BUILD"; targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }; parameters: { strength: PositiveInteger } }
      | {
          type: "FLEET_MOVE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
          parameters: { speed: PositiveNumber }
        }
      | {
          type: "FLEET_ASSAULT"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: Record<string, never>
        }
      | {
          type: "FLEET_COLONIZE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: { strengthRequirement: PositiveInteger }
        }
    >
  }
  turnThreeRng: Rng<number>
  reloadTurn: ReloadTurnCallback
  p: ReturnType<typeof createPlanetStub>
  strengthTotal: (state: ResolvedTurnState) => number
}

export function assertFindJourneyForSubmission({
  turnFive,
  moveActionId,
  aSource,
  turnFour,
  p,
  bAtP,
  strengthTotal,
}: AssertFindJourneyForSubmissionInput): void {
  expect(findJourneyForSubmission(turnFive, PLAYER_A, moveActionId)).toMatchObject({ strength: 5, distanceToEnd: 1 })
  expect(turnFive.fleets[aSource.id]?.strength).toBe(15)
  expect(turnFive.players[PLAYER_A]?.resources).toStrictEqual(turnFour.players[PLAYER_A]?.resources)
  expect(turnFive.planets[p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(turnFive.fleets[bAtP.id]?.strength).toBe(27)
  expect(strengthTotal(turnFive)).toBe(69)
  expect(turnFive.resolvedActions).toStrictEqual([])
  expect(
    turnFive.resolvedContinuations
      .flatMap(({ actionOutcomes }) => actionOutcomes)
      .map(outcomeText)
      .join(" "),
  ).not.toContain("exchanged")
  expect(
    turnFive.resolvedContinuations
      .flatMap(({ actionOutcomes }) => actionOutcomes)
      .map(outcomeText)
      .join(" "),
  ).not.toContain("colonized Planet")
}

export type AssertFindJourneyForSubmissionInput = {
  turnFive: ResolvedTurnState
  moveActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  turnFour: ResolvedTurnState
  p: ReturnType<typeof createPlanetStub>
  bAtP: ReturnType<typeof createFleetStub>
  strengthTotal: (state: ResolvedTurnState) => number
}

export function assertDeparture({ departure, target, source, journey, ruleset }: AssertDepartureInput): void {
  assertDeparture2({ departure, target, source, journey })

  const arrival = resolveContinuation(departure, 2, createSeededRng(1234), ruleset)

  assertArrival({ arrival, target, journey })

  const emptyTurn = resolveContinuation(arrival, 3, createSeededRng(1234), ruleset)
  expect(emptyTurn.fleets[journey.id]?.strength).toBe(15)
  expect(emptyTurn.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(emptyTurn.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
}

export type AssertDepartureInput = {
  departure: ResolvedTurnState
  target: ReturnType<typeof createPlanetStub>
  source: ReturnType<typeof createFleetStub>
  journey: ResolutionFleet
  ruleset: Ruleset
}

export type AssertDeparture2Input = {
  departure: ResolvedTurnState
  target: ReturnType<typeof createPlanetStub>
  source: ReturnType<typeof createFleetStub>
  journey: ResolutionFleet
}

export function assertDeparture2({ departure, target, source, journey }: AssertDeparture2Input): void {
  expect(departure.planets[target.id]?.ownerPlayerId).toBeNull()
  expect(departure.fleets[source.id]?.strength).toBe(5)
  expect(journey).toMatchObject({
    strength: 45,
    destinationPlanetId: target.id,
    distanceToEnd: 0.5,
    movement: {
      speed: 2,
      departureTurn: 1,
      submission: {
        actionDefinitionId: SeedOutpostTest.id,
        selectedTargets: { force: source.id, site: target.id },
        selectedInputs: { quota: 45 },
      },
    },
  })
  expect(journey.movement?.pendingArrivalEffects).toContainEqual(
    expect.objectContaining({
      effectDefinition: {
        type: "FLEET_COLONIZE",
        targets: {
          fleet: { actionTargetTag: "force", targetType: "FLEET" },
          planet: { actionTargetTag: "site", targetType: "PLANET" },
        },
        parameters: { strengthRequirement: 30 },
      },
    }),
  )
  expect(departure.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
}

export function assertArrival({ arrival, target, journey }: AssertArrivalInput): void {
  expect(arrival.planets[target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(arrival.fleets[journey.id]?.arrivedAtTick).toBe(5)
  expect(arrival.fleets[journey.id]).toMatchObject({
    originPlanetId: target.id,
    strength: 15,
    movement: undefined,
    destinationPlanetId: undefined,
    distanceToEnd: undefined,
  })
  expect(arrival.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
  expect(arrival.resolvedContinuations[0]?.actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("colonized Planet"),
  })
}

export type AssertArrivalInput = {
  arrival: ResolvedTurnState
  target: ReturnType<typeof createPlanetStub>
  journey: ResolutionFleet
}

function verifyReleased({
  journeyActionBindings,
  eligibilityState,
  afterArrival,
  ruleset,
  aTurnFour,
  moveActionId,
  aSource,
  q,
}: VerifyReleasedInput): void {
  for (const { playerId, actionId } of journeyActionBindings) {
    const state = eligibilityState(
      playerId,
      4,
      afterArrival.players,
      Object.values(afterArrival.planets),
      Object.values(afterArrival.fleets),
    )
    const released = evaluateActionSelection({ state, ruleset, draft: createFleetSelectionDraft(actionId, {}, {}) })
    expect(released.status).toBe("INCOMPLETE")
    expect(released.issues.map(({ code }) => code)).not.toContain("ACTION_ALREADY_IN_PROGRESS")
  }
  const reuseEvaluation = evaluateActionSelection({
    state: aTurnFour,
    ruleset,
    draft: createFleetSelectionDraft(moveActionId, { fleet: aSource.id, planet: q.id }, { strength: 5 }),
  })
  expect(reuseEvaluation.status).toBe("ELIGIBLE")
  expect(reuseEvaluation.strengthCommitments[aSource.id]).toBe(5)
  expect(reuseEvaluation.remainingStrength[aSource.id]).toBe(15)
  expect(reuseEvaluation.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
}

function verifyReuseSubmission({
  moveActionId,
  ordinaryMove,
  aSource,
  q,
  turnThreeRng,
  reloadTurn,
  afterArrival,
  p,
  bAtP,
  strengthTotal,
}: VerifyReuseSubmissionInput): void {
  const reuseSubmission = submit({
    id: moveActionId,
    playerId: PLAYER_A,
    actionDefinitionId: ordinaryMove.id,
    source: aSource,
    target: q,
    strength: 5,
  })
  const turnFourRng = Rng.fromState(turnThreeRng.getState(), mulberry32Prng)
  const turnFour = reloadTurn(afterArrival, 4, [reuseSubmission], turnFourRng)
  const reusedJourney = findJourneyForSubmission(turnFour, PLAYER_A, moveActionId)
  expect(turnFour.fleets[aSource.id]?.strength).toBe(15)
  expect(reusedJourney).toMatchObject({ strength: 5, distanceToEnd: 3, movement: { departureTurn: 4 } })
  expect(turnFour.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 69,
    [ResourceType.FUEL]: 8,
    [ResourceType.COLONY]: 7,
  })
  expect(turnFour.planets[p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(turnFour.fleets[bAtP.id]?.strength).toBe(27)
  expect(strengthTotal(turnFour)).toBe(69)

  const turnFiveRng = Rng.fromState(turnFourRng.getState(), mulberry32Prng)
  const turnFive = reloadTurn(turnFour, 5, [], turnFiveRng)

  assertFindJourneyForSubmission({ turnFive, moveActionId, aSource, turnFour, p, bAtP, strengthTotal })
}

type VerifyReleasedInput = {
  journeyActionBindings: Array<{ playerId: PlayerId; actionId: ActionId; freeMoveActionId: ActionId }>
  eligibilityState: EligibilityStateCallback
  afterArrival: ResolvedTurnState
  ruleset: Ruleset
  aTurnFour: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  moveActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  q: ReturnType<typeof createPlanetStub>
}

type VerifyReuseSubmissionInput = {
  moveActionId: ActionId
  ordinaryMove: {
    id: ActionDefinitionId
    name: string
    type: "AGENDA" | "DIRECTIVE" | "PROGRAM"
    tier: "BASIC" | "STANDARD" | "IMPROVED" | "ADVANCED" | "EXCEPTIONAL"
    inputs: Record<InputTag, { type: "POSITIVE_INTEGER"; label: string }>
    targets: Record<
      TargetTag,
      {
        targetType: "FLEET" | "PLANET" | "PLAYER"
        constraints: ReadonlyArray<
          | { type: "OWNED_BY_SUBMITTING_PLAYER"; references: Record<string, never>; parameters: Record<string, never> }
          | { type: "STATIONARY_FLEET"; references: Record<string, never>; parameters: Record<string, never> }
          | { type: "WITHIN_FLEET_RANGE"; references: { sourceFleetTag: TargetTag }; parameters: { maxDistance: PositiveNumber } }
          | { type: "DIFFERENT_FROM_FLEET_ORIGIN"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
          | { type: "AT_FLEET_PLANET"; references: { sourceFleetTag: TargetTag }; parameters: Record<string, never> }
          | { type: "UNCLAIMED_PLANET"; references: Record<string, never>; parameters: Record<string, never> }
        >
      }
    >
    costs: Array<{
      type: "RESOURCE_LOSS"
      targets: Record<string, never>
      parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
    }>
    effects: Array<
      | {
          type: "RESOURCE_LOSS"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | {
          type: "RESOURCE_GAIN"
          targets: Record<string, never>
          parameters: Readonly<{ quantity: PositiveNumber; resourceType: "INFLUENCE" | "METAL" | "FUEL" | "ENERGY" | "COLONY" }>
        }
      | { type: "VICTORY"; targets: Record<string, never>; parameters: Record<string, never> }
      | { type: "FLEET_BUILD"; targets: { planet: EffectDefinitionTargetDefinition<"PLANET"> }; parameters: { strength: PositiveInteger } }
      | {
          type: "FLEET_MOVE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          inputs: { strength: { actionInputTag: InputTag; inputType: "POSITIVE_INTEGER" } }
          parameters: { speed: PositiveNumber }
        }
      | {
          type: "FLEET_ASSAULT"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: Record<string, never>
        }
      | {
          type: "FLEET_COLONIZE"
          targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
          parameters: { strengthRequirement: PositiveInteger }
        }
    >
  }
  aSource: ReturnType<typeof createFleetStub>
  q: ReturnType<typeof createPlanetStub>
  turnThreeRng: Rng<number>
  reloadTurn: ReloadTurnCallback
  afterArrival: ResolvedTurnState
  p: ReturnType<typeof createPlanetStub>
  bAtP: ReturnType<typeof createFleetStub>
  strengthTotal: (state: ResolvedTurnState) => number
}

type EligibilityStateCallback = (
  playerId: PlayerId,
  turn: number,
  players: Readonly<Record<PlayerId, ResolutionPlayer>>,
  currentPlanets: ReadonlyArray<Pick<ReturnType<typeof createPlanetStub>, "id" | "ownerPlayerId" | "x" | "y">>,
  currentFleets: ReadonlyArray<ReturnType<typeof createFleetStub>>,
) => Readonly<{
  gameId: GameId
  turn: number
  submittingPlayerId: PlayerId
  resources: Readonly<ReturnType<typeof createResourcesStub>>
  players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
  planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
  fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
  actions: readonly Action[]
}>

type ReloadTurnCallback = (
  previous: ResolvedTurnState,
  turn: number,
  submissions: Array<
    Readonly<{
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, TargetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }>
  >,
  rng: ReturnType<typeof createSeededRng>,
) => ResolvedTurnState
