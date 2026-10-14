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
import { required } from "#shared/testing/required.ts"
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

export function assertTurnTwoJourneys2(input: AssertTurnTwoJourneys2Input): void {
  expect(input.turnTwoJourneys.map(({ id }) => input.preCombatState.fleets[id]?.arrivedAtTick)).toStrictEqual([5, 10, 10, 8])
  expect(input.preCombatState.fleets[input.cAttackJourney.id]).toMatchObject({
    id: input.cAttackJourney.id,
    ownerPlayerId: PLAYER_C,
    originPlanetId: input.p.id,
    strength: 16,
    arrivedAtTick: 8,
  })
  expect(
    input.preCombatContext.pendingArrivalAssaults.map(({ initiatingJourneyId, actualFleetId, planetId, tick }) => ({
      initiatingJourneyId,
      actualFleetId,
      planetId,
      tick,
    })),
  ).toStrictEqual([{ initiatingJourneyId: input.cAttackJourney.id, actualFleetId: input.cAttackJourney.id, planetId: input.p.id, tick: 8 }])
  expect(findResolvedContinuation(input.preCombatContext, PLAYER_C, input.attackActionId).actionOutcomes.map(outcomeText)).toStrictEqual([
    'Fleet "i4-c-source" moved 0.75 light years towards Planet "i4-destination-p"',
    'Fleet "i4-c-source" arrived on Planet "i4-destination-p"',
  ])
  expect(input.strengthTotal(input.turnTwo)).toBe(121)
  expect(input.turnTwo.players[PLAYER_A]?.resources).toStrictEqual(input.departure.players[PLAYER_A]?.resources)
  expect(input.turnTwo.players[PLAYER_B]?.resources).toStrictEqual(input.departure.players[PLAYER_B]?.resources)
  expect(input.turnTwo.players[PLAYER_C]?.resources).toStrictEqual(input.departure.players[PLAYER_C]?.resources)
}

export function assertAAtP2(input: AssertAAtP2Input): void {
  expect(input.aAtP).toMatchObject({ strength: 7, arrivedAtTick: 5 })
  expect(input.aAtQ).toMatchObject({ strength: 15, arrivedAtTick: 10 })
  expect(input.bAtP).toMatchObject({ strength: 27, arrivedAtTick: 10 })
  expect(input.afterArrival.planets[input.p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(input.afterArrival.planets[input.q.id]).ownerPlayerId).toBeNull()
  expect(Object.values(input.afterArrival.fleets).some(({ ownerPlayerId }) => ownerPlayerId === PLAYER_C)).toBe(false)
  expect(input.afterArrival.removedFleetIds).toContain(input.cAttackJourney.id)
  expect(input.strengthTotal(input.afterArrival)).toBe(69)
  expect(required(input.afterArrival.players[PLAYER_A]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 72,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
  expect(required(input.afterArrival.players[PLAYER_B]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 75,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 7,
  })
  expect(required(input.afterArrival.players[PLAYER_C]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 95,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
  expect(findResolvedContinuation(input.afterArrival, PLAYER_A, input.colonizeActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("colonized Planet"),
  })
  expect(
    findResolvedContinuation(input.afterArrival, PLAYER_A, input.moveActionId).actionOutcomes.map(outcomeText).join(" "),
  ).not.toContain("exchanged")
  expect(findResolvedContinuation(input.afterArrival, PLAYER_B, input.colonizeActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "PREVENTED",
  })
  expect(findResolvedContinuation(input.afterArrival, PLAYER_C, input.attackActionId).actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("exchanged 16 Strength with 70 enemy Strength"),
  })
  expect([input.aColonizeJourney.strength, input.bColonizeJourney.strength]).toStrictEqual([35, 35])
  expect([input.aAtP.strength, input.bAtP.strength]).toStrictEqual([7, 27])
  expect(input.aColonizeJourney.strength - input.aAtP.strength).toBe(28)
  expect(input.bColonizeJourney.strength - input.bAtP.strength).toBe(8)
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

export function assertAAtP(input: AssertAAtPInput): void {
  expect(input.aAtP.strength + input.bAtP.strength + input.aAtQ.strength + input.aAtHome.strength).toBe(69)

  const aTurnFour = input.eligibilityState(
    PLAYER_A,
    4,
    input.afterArrival.players,
    Object.values(input.afterArrival.planets),
    Object.values(input.afterArrival.fleets),
  )

  verifyReleased({ ...input, aTurnFour })

  verifyReuseSubmission({ ...input })
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

export function assertFindJourneyForSubmission(input: AssertFindJourneyForSubmissionInput): void {
  expect(findJourneyForSubmission(input.turnFive, PLAYER_A, input.moveActionId)).toMatchObject({ strength: 5, distanceToEnd: 1 })
  expect(required(input.turnFive.fleets[input.aSource.id]).strength).toBe(15)
  expect(input.turnFive.players[PLAYER_A]?.resources).toStrictEqual(input.turnFour.players[PLAYER_A]?.resources)
  expect(input.turnFive.planets[input.p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(input.turnFive.fleets[input.bAtP.id]).strength).toBe(27)
  expect(input.strengthTotal(input.turnFive)).toBe(69)
  expect(input.turnFive.resolvedActions).toStrictEqual([])
  expect(
    input.turnFive.resolvedContinuations
      .flatMap(({ actionOutcomes }) => actionOutcomes)
      .map(outcomeText)
      .join(" "),
  ).not.toContain("exchanged")
  expect(
    input.turnFive.resolvedContinuations
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

export function assertDeparture(input: AssertDepartureInput): void {
  assertDeparture2({ ...input })

  const arrival = resolveContinuation(input.departure, 2, createSeededRng(1234), input.ruleset)

  assertArrival({ ...input, arrival })

  const emptyTurn = resolveContinuation(arrival, 3, createSeededRng(1234), input.ruleset)
  expect(required(emptyTurn.fleets[input.journey.id]).strength).toBe(15)
  expect(emptyTurn.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(emptyTurn.players[PLAYER_A]).resources).toMatchObject({
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

export function assertDeparture2(input: AssertDeparture2Input): void {
  expect(required(input.departure.planets[input.target.id]).ownerPlayerId).toBeNull()
  expect(required(input.departure.fleets[input.source.id]).strength).toBe(5)
  expect(input.journey).toMatchObject({
    strength: 45,
    destinationPlanetId: input.target.id,
    distanceToEnd: 0.5,
    movement: {
      speed: 2,
      departureTurn: 1,
      submission: {
        actionDefinitionId: SeedOutpostTest.id,
        selectedTargets: { force: input.source.id, site: input.target.id },
        selectedInputs: { quota: 45 },
      },
    },
  })
  expect(required(input.journey.movement).pendingArrivalEffects).toContainEqual(
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
  expect(required(input.departure.players[PLAYER_A]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
}

export function assertArrival(input: AssertArrivalInput): void {
  expect(input.arrival.planets[input.target.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(input.arrival.fleets[input.journey.id]).arrivedAtTick).toBe(5)
  expect(input.arrival.fleets[input.journey.id]).toMatchObject({
    originPlanetId: input.target.id,
    strength: 15,
    movement: undefined,
    destinationPlanetId: undefined,
    distanceToEnd: undefined,
  })
  expect(required(input.arrival.players[PLAYER_A]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 43,
    [ResourceType.FUEL]: 98,
  })
  expect(required(input.arrival.resolvedContinuations[0]).actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining("colonized Planet"),
  })
}

export type AssertArrivalInput = {
  arrival: ResolvedTurnState
  target: ReturnType<typeof createPlanetStub>
  journey: ResolutionFleet
}

function verifyReleased(input: VerifyReleasedInput): void {
  for (const { playerId, actionId } of input.journeyActionBindings) {
    const state = input.eligibilityState(
      playerId,
      4,
      input.afterArrival.players,
      Object.values(input.afterArrival.planets),
      Object.values(input.afterArrival.fleets),
    )
    const released = evaluateActionSelection({ state, ruleset: input.ruleset, draft: createFleetSelectionDraft(actionId, {}, {}) })
    expect(released.status).toBe("INCOMPLETE")
    expect(released.issues.map(({ code }) => code)).not.toContain("ACTION_ALREADY_IN_PROGRESS")
  }
  const reuseEvaluation = evaluateActionSelection({
    state: input.aTurnFour,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { fleet: input.aSource.id, planet: input.q.id }, { strength: 5 }),
  })
  expect(reuseEvaluation.status).toBe("ELIGIBLE")
  expect(reuseEvaluation.strengthCommitments[input.aSource.id]).toBe(5)
  expect(reuseEvaluation.remainingStrength[input.aSource.id]).toBe(15)
  expect(reuseEvaluation.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
}

function verifyReuseSubmission(input: VerifyReuseSubmissionInput): void {
  const reuseSubmission = submit({
    id: input.moveActionId,
    playerId: PLAYER_A,
    actionDefinitionId: input.ordinaryMove.id,
    source: input.aSource,
    target: input.q,
    strength: 5,
  })
  const turnFourRng = Rng.fromState(input.turnThreeRng.getState(), mulberry32Prng)
  const turnFour = input.reloadTurn(input.afterArrival, 4, [reuseSubmission], turnFourRng)
  const reusedJourney = findJourneyForSubmission(turnFour, PLAYER_A, input.moveActionId)
  expect(required(turnFour.fleets[input.aSource.id]).strength).toBe(15)
  expect(reusedJourney).toMatchObject({ strength: 5, distanceToEnd: 3, movement: { departureTurn: 4 } })
  expect(required(turnFour.players[PLAYER_A]).resources).toMatchObject({
    [ResourceType.INFLUENCE]: 69,
    [ResourceType.FUEL]: 8,
    [ResourceType.COLONY]: 7,
  })
  expect(turnFour.planets[input.p.id]?.ownerPlayerId).toBe(PLAYER_A)
  expect(required(turnFour.fleets[input.bAtP.id]).strength).toBe(27)
  expect(input.strengthTotal(turnFour)).toBe(69)

  const turnFiveRng = Rng.fromState(turnFourRng.getState(), mulberry32Prng)
  const turnFive = input.reloadTurn(turnFour, 5, [], turnFiveRng)

  assertFindJourneyForSubmission({ ...input, turnFive, turnFour })
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
