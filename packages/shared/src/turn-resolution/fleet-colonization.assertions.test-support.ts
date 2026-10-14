import { Assert } from "@guillaume-docquier/tools-ts"
import type { PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import { expect } from "vitest"
import { evaluateActionSelection, evaluateSubmittedActions } from "#shared/action-submission/evaluateActionSelection.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { createSeededRng } from "#shared/testing/createSeededRng.ts"
import type { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import type { ResolvedTurnState } from "#shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { PendingArrivalAssaultIntent, PendingArrivalColonizationIntent } from "#shared/turn-resolution/TurnContext.ts"
import type { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"
import { assertTurnTwoJourneys2 } from "./fleet-colonization.assertions-2.test-support.ts"
import {
  PLAYER_A,
  PLAYER_B,
  PLAYER_C,
  createFleetSelectionDraft,
  replaceActionById,
  findJourneyForSubmission,
} from "./fleet-colonization.test-support.ts"

export function assertColonizeEvaluation(input: AssertColonizeEvaluationInput): void {
  const colonizeEvaluation = evaluateActionSelection({
    state: input.initialA,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.colonizeActionId, { fleet: input.aSource.id, planet: input.p.id }, { strength: 35 }),
  })
  expect(colonizeEvaluation.status).toBe("ELIGIBLE")
  expect(colonizeEvaluation.strengthCommitments[input.aSource.id]).toBe(35)
  expect(colonizeEvaluation.remainingStrength[input.aSource.id]).toBe(35)
  expect(colonizeEvaluation.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 25,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })

  const aWithColonize = {
    ...input.initialA,
    actions: replaceActionById(input.initialA.actions, input.aColonize),
  }
  const aMoveEvaluation = evaluateActionSelection({
    state: aWithColonize,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { fleet: input.aSource.id, planet: input.q.id }, { strength: 15 }),
  })
  expect(aMoveEvaluation.status).toBe("ELIGIBLE")
  expect(aMoveEvaluation.strengthCommitments[input.aSource.id]).toBe(50)
  expect(aMoveEvaluation.remainingStrength[input.aSource.id]).toBe(20)
  expect(aMoveEvaluation.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 28,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
  const tooFarEvaluation = evaluateActionSelection({
    state: aWithColonize,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { fleet: input.aSource.id, planet: input.outsideRange.id }, { strength: 15 }),
  })
  expect(tooFarEvaluation.status).toBe("INELIGIBLE")
  expect(tooFarEvaluation.issues.map(({ code }) => code)).toContain("OUT_OF_RANGE")

  const overallocatedEvaluation = evaluateActionSelection({
    state: aWithColonize,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { fleet: input.aSource.id, planet: input.q.id }, { strength: 36 }),
  })
  expect(overallocatedEvaluation.status).toBe("INELIGIBLE")
  expect(overallocatedEvaluation.strengthCommitments[input.aSource.id]).toBe(71)
  expect(overallocatedEvaluation.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")
  expect(aWithColonize.actions.find(({ id }) => id === input.colonizeActionId)).toStrictEqual(input.aColonize)
  expect(input.initialPlayers[PLAYER_A]?.resources).toStrictEqual(
    createResourcesStub({
      [ResourceType.INFLUENCE]: 100,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 10,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 7,
    }),
  )

  const aWithBoth = {
    ...aWithColonize,
    actions: replaceActionById(aWithColonize.actions, input.aMove),
  }
  const replacementEvaluation = evaluateActionSelection({
    state: aWithBoth,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { fleet: input.aSource.id, planet: input.q.id }, { strength: 14 }),
  })
  expect(replacementEvaluation.status).toBe("ELIGIBLE")
  expect(replacementEvaluation.strengthCommitments[input.aSource.id]).toBe(49)
  expect(replacementEvaluation.remainingStrength[input.aSource.id]).toBe(21)
  const cancelMoveEvaluation = evaluateSubmittedActions({ state: aWithBoth, ruleset: input.ruleset, submissions: [input.aColonize] })
  expect(cancelMoveEvaluation.status).toBe("ELIGIBLE")
  expect(cancelMoveEvaluation.strengthCommitments[input.aSource.id]).toBe(35)
  expect(cancelMoveEvaluation.remainingStrength[input.aSource.id]).toBe(35)
  expect(cancelMoveEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(25)
  expect(cancelMoveEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(0)
  const cancelColonizeEvaluation = evaluateSubmittedActions({ state: aWithBoth, ruleset: input.ruleset, submissions: [input.aMove] })
  expect(cancelColonizeEvaluation.status).toBe("ELIGIBLE")
  expect(cancelColonizeEvaluation.strengthCommitments[input.aSource.id]).toBe(15)
  expect(cancelColonizeEvaluation.remainingStrength[input.aSource.id]).toBe(55)
  expect(cancelColonizeEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(3)
  expect(cancelColonizeEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(1)
}

export type AssertColonizeEvaluationInput = {
  initialA: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  ruleset: Ruleset
  colonizeActionId: ActionId
  aSource: ReturnType<typeof createFleetStub>
  p: ReturnType<typeof createPlanetStub>
  aColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  moveActionId: ActionId
  q: ReturnType<typeof createPlanetStub>
  outsideRange: ReturnType<typeof createPlanetStub>
  initialPlayers: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
  aMove: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
}

export function assertIncompleteForce(input: AssertIncompleteForceInput): void {
  const incompleteForce = evaluateActionSelection({
    state: input.initialA,
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.moveActionId, { planet: input.q.id }, { strength: 15 }),
  })
  expect(incompleteForce.status).toBe("INCOMPLETE")
  expect(incompleteForce.missingTargets).toContain("fleet")
  const incompleteApiSubmission = createSubmittedActionStub({
    id: input.moveActionId,
    playerId: PLAYER_A,
    actionDefinitionId: input.ordinaryMove.id,
    selectedTargets: { planet: input.q.id },
    selectedInputs: { strength: 15 },
  })
  expect(
    evaluateSubmittedActions({ state: input.initialA, ruleset: input.ruleset, submissions: [incompleteApiSubmission] }).status,
  ).not.toBe("ELIGIBLE")

  const validA = evaluateSubmittedActions({ state: input.initialA, ruleset: input.ruleset, submissions: [input.aColonize, input.aMove] })
  const validB = evaluateSubmittedActions({
    state: input.eligibilityState(PLAYER_B, 1, input.initialPlayers, input.planets, input.fleets),
    ruleset: input.ruleset,
    submissions: [input.bColonize],
  })
  const validC = evaluateSubmittedActions({
    state: input.eligibilityState(PLAYER_C, 1, input.initialPlayers, input.planets, input.fleets),
    ruleset: input.ruleset,
    submissions: [input.cAttack],
  })
  expect(validA.status).toBe("ELIGIBLE")
  expect(validA.strengthCommitments[input.aSource.id]).toBe(50)
  expect(validA.remainingStrength[input.aSource.id]).toBe(20)
  expect(validB.status).toBe("ELIGIBLE")
  expect(validB.resourceCommitments[ResourceType.INFLUENCE]).toBe(25)
  expect(validC.status).toBe("ELIGIBLE")
  expect(validC.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 5,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
}

export type AssertIncompleteForceInput = {
  initialA: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  ruleset: Ruleset
  moveActionId: ActionId
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
  aColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  aMove: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  eligibilityState: EligibilityStateCallback
  initialPlayers: Record<PlayerId, { id: PlayerId; resources: ReturnType<typeof createResourcesStub> }>
  planets: Array<ReturnType<typeof createPlanetStub>>
  fleets: Array<ReturnType<typeof createFleetStub>>
  bColonize: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  cAttack: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  aSource: ReturnType<typeof createFleetStub>
}

export function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect([input.aSource, input.bSource, input.cSource].map(({ id }) => input.departure.fleets[id])).toStrictEqual([
    expect.objectContaining({ strength: 20 }),
    undefined,
    undefined,
  ])
  expect(
    [input.aColonizeJourney, input.aMoveJourney, input.bColonizeJourney, input.cAttackJourney].map(
      ({ strength, distanceToEnd, movement }) => ({
        strength,
        distanceToEnd,
        speed: movement?.speed,
      }),
    ),
  ).toStrictEqual([
    { strength: 35, distanceToEnd: 2.5, speed: 2 },
    { strength: 15, distanceToEnd: 3, speed: 2 },
    { strength: 35, distanceToEnd: 3, speed: 2 },
    { strength: 16, distanceToEnd: 2.75, speed: 2 },
  ])
  expect(input.strengthTotal(input.departure)).toBe(121)
  expect(input.departure.players[PLAYER_A]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 72,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
  expect(input.departure.players[PLAYER_B]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 75,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 7,
  })
  expect(input.departure.players[PLAYER_C]?.resources).toMatchObject({
    [ResourceType.INFLUENCE]: 95,
    [ResourceType.FUEL]: 9,
    [ResourceType.COLONY]: 7,
  })
}

export type AssertScenarioState2Input = {
  aSource: ReturnType<typeof createFleetStub>
  bSource: ReturnType<typeof createFleetStub>
  cSource: ReturnType<typeof createFleetStub>
  departure: ResolvedTurnState
  aColonizeJourney: ReturnType<typeof createFleetStub>
  aMoveJourney: ReturnType<typeof createFleetStub>
  bColonizeJourney: ReturnType<typeof createFleetStub>
  cAttackJourney: ReturnType<typeof createFleetStub>
  strengthTotal: (state: ResolvedTurnState) => number
}

export function assertTurnTwoJourneys(input: AssertTurnTwoJourneysInput): void {
  assertTurnTwoJourneys2({ ...input })

  for (const { playerId, actionId } of input.journeyActionBindings) {
    const state = input.eligibilityState(
      playerId,
      1,
      input.departure.players,
      Object.values(input.departure.planets),
      Object.values(input.departure.fleets),
    )
    const departureLock = evaluateActionSelection({ state, ruleset: input.ruleset, draft: createFleetSelectionDraft(actionId, {}, {}) })
    expect(departureLock.status).toBe("INELIGIBLE")
    expect(departureLock.issues.map(({ code }) => code)).toContain("ACTION_ALREADY_IN_PROGRESS")
  }
  const freeAThirdInstance = evaluateActionSelection({
    state: input.eligibilityState(
      PLAYER_A,
      1,
      input.departure.players,
      Object.values(input.departure.planets),
      Object.values(input.departure.fleets),
    ),
    ruleset: input.ruleset,
    draft: createFleetSelectionDraft(input.attackActionId, { fleet: input.aSource.id, planet: input.p.id }, { strength: 20 }),
  })
  expect(freeAThirdInstance.status).toBe("ELIGIBLE")
  expect(freeAThirdInstance.strengthCommitments[input.aSource.id]).toBe(20)
  expect(freeAThirdInstance.remainingStrength[input.aSource.id]).toBe(0)
  expect(freeAThirdInstance.resourceCommitments).toMatchObject({
    [ResourceType.INFLUENCE]: 5,
    [ResourceType.FUEL]: 1,
  })
  for (const { playerId, actionId } of input.journeyActionBindings) {
    const currentFleets = Object.values(input.turnTwo.fleets)
    const currentPlanets = Object.values(input.turnTwo.planets)
    const state = input.eligibilityState(playerId, 2, input.turnTwo.players, currentPlanets, currentFleets)
    const occupancy = evaluateActionSelection({ state, ruleset: input.ruleset, draft: createFleetSelectionDraft(actionId, {}, {}) })
    expect(occupancy.status).toBe("INELIGIBLE")
    expect(occupancy.issues.map(({ code }) => code)).toContain("ACTION_ALREADY_IN_PROGRESS")
    const journey = findJourneyForSubmission(input.turnTwo, playerId, actionId)
    const destinationPlanetId = journey.destinationPlanetId
    Assert.isDefined(destinationPlanetId)
    const editOrReuse = evaluateActionSelection({
      state,
      ruleset: input.ruleset,
      draft: createFleetSelectionDraft(
        actionId,
        { fleet: journey.id, planet: destinationPlanetId },
        { strength: Math.max(1, journey.strength - 1) },
      ),
    })
    expect(editOrReuse.status).toBe("INELIGIBLE")
    expect(editOrReuse.issues.map(({ code }) => code)).toContain("ACTION_ALREADY_IN_PROGRESS")
  }
  for (const { playerId, actionId, freeMoveActionId } of input.journeyActionBindings) {
    const journey = findJourneyForSubmission(input.turnTwo, playerId, actionId)
    const destinationPlanetId = journey.destinationPlanetId
    Assert.isDefined(destinationPlanetId)
    const attempt = evaluateActionSelection({
      state: input.eligibilityState(
        playerId,
        2,
        input.turnTwo.players,
        Object.values(input.turnTwo.planets),
        Object.values(input.turnTwo.fleets),
      ),
      ruleset: input.ruleset,
      draft: createFleetSelectionDraft(
        freeMoveActionId,
        { fleet: journey.id, planet: destinationPlanetId },
        { strength: journey.strength },
      ),
    })
    expect(attempt.status).toBe("INELIGIBLE")
    expect(attempt.issues.map(({ code }) => code)).toContain("FLEET_NOT_STATIONARY")
  }
}

export type AssertTurnTwoJourneysInput = {
  turnTwoJourneys: Array<ReturnType<typeof createFleetStub>>
  preCombatState: ReturnType<typeof createTurnStateStub>
  cAttackJourney: ReturnType<typeof createFleetStub>
  p: ReturnType<typeof createPlanetStub>
  preCombatContext: Readonly<{
    rng: ReturnType<typeof createSeededRng>
    turnState: ReturnType<typeof createTurnStateStub>
    effectPool: EffectPool
    ruleset: Ruleset
    previousJourneyFleetIds: readonly FleetId[]
    newDepartureFleetIds: Set<FleetId>
    removedFleetIds: Set<FleetId>
    changedPlanetIds: Set<PlanetId>
    resolvedContinuations: Array<ResolvedTurnState["resolvedContinuations"][number]>
    pendingArrivalAssaults: PendingArrivalAssaultIntent[]
    pendingArrivalColonizations: PendingArrivalColonizationIntent[]
    fleetIdRebindings: Map<FleetId, FleetId>
  }>
  attackActionId: ActionId
  strengthTotal: (state: ResolvedTurnState) => number
  turnTwo: ResolvedTurnState
  departure: ResolvedTurnState
  journeyActionBindings: Array<{ playerId: PlayerId; actionId: ActionId; freeMoveActionId: ActionId }>
  eligibilityState: EligibilityStateCallback
  ruleset: Ruleset
  aSource: ReturnType<typeof createFleetStub>
}

export type AssertTurnTwoJourneys2Input = {
  turnTwoJourneys: Array<ReturnType<typeof createFleetStub>>
  preCombatState: ReturnType<typeof createTurnStateStub>
  cAttackJourney: ReturnType<typeof createFleetStub>
  p: ReturnType<typeof createPlanetStub>
  preCombatContext: Readonly<{
    rng: ReturnType<typeof createSeededRng>
    turnState: ReturnType<typeof createTurnStateStub>
    effectPool: EffectPool
    ruleset: Ruleset
    previousJourneyFleetIds: readonly FleetId[]
    newDepartureFleetIds: Set<FleetId>
    removedFleetIds: Set<FleetId>
    changedPlanetIds: Set<PlanetId>
    resolvedContinuations: Array<ResolvedTurnState["resolvedContinuations"][number]>
    pendingArrivalAssaults: PendingArrivalAssaultIntent[]
    pendingArrivalColonizations: PendingArrivalColonizationIntent[]
    fleetIdRebindings: Map<FleetId, FleetId>
  }>
  attackActionId: ActionId
  strengthTotal: (state: ResolvedTurnState) => number
  turnTwo: ResolvedTurnState
  departure: ResolvedTurnState
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
