import { branded } from "@guillaume-docquier/tools-ts"
import { expect } from "vitest"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  type EligibilityState,
} from "#shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode } from "#shared/action-submission/selectionEvaluation.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { SeedOutpostTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { assertMoveReplacement } from "./evaluateActionSelection.reservations.assertions-2.test-support.ts"

export function assertEvaluate({ state, ruleset, actionId, force, playerId, site, beyondRange }: AssertEvaluateInput): void {
  const evaluate = (siteId: PlanetId, quota: number, resources = state.resources): ReturnType<typeof evaluateActionSelection> =>
    evaluateActionSelection({
      state: { ...state, resources },
      ruleset,
      draft: {
        actionId,
        selectedTargets: {
          [branded<TargetTag>("force")]: force.id,
          [branded<TargetTag>("site")]: siteId,
        },
        selectedInputs: { [branded<InputTag>("quota")]: quota },
      },
    })

  const exactThresholdSubmission = createSubmittedActionStub({
    id: actionId,
    playerId,
    actionDefinitionId: SeedOutpostTest.id,
    selectedTargets: { force: force.id, site: site.id },
    selectedInputs: { quota: 30 },
  })
  const evaluateSubmittedAtBudget = (resources: EligibilityState["resources"]): ReturnType<typeof evaluateSubmittedActions> =>
    evaluateSubmittedActions({ state: { ...state, resources }, ruleset, submissions: [exactThresholdSubmission] })
  const submittedAtInsufficientInfluence = evaluateSubmittedAtBudget(
    createResourcesStub({ [ResourceType.INFLUENCE]: 6, [ResourceType.FUEL]: 2 }),
  )
  const submittedAtInsufficientFuel = evaluateSubmittedAtBudget(
    createResourcesStub({ [ResourceType.INFLUENCE]: 7, [ResourceType.FUEL]: 1 }),
  )
  const submittedAtExactBudget = evaluateSubmittedAtBudget(createResourcesStub({ [ResourceType.INFLUENCE]: 7, [ResourceType.FUEL]: 2 }))
  const insufficientInfluence = evaluate(site.id, 30, createResourcesStub({ [ResourceType.INFLUENCE]: 6, [ResourceType.FUEL]: 2 }))
  const insufficientFuel = evaluate(site.id, 30, createResourcesStub({ [ResourceType.INFLUENCE]: 7, [ResourceType.FUEL]: 1 }))
  const belowRequirement = evaluate(site.id, 29)
  const exactRequirement = evaluate(site.id, 30)
  const fullForce = evaluate(site.id, 45)
  const beyondRangeSelection = evaluate(beyondRange.id, 30)

  assertSubmittedAtInsufficientInfluence({
    submittedAtInsufficientInfluence,
    submittedAtInsufficientFuel,
    submittedAtExactBudget,
    force,
    insufficientInfluence,
    insufficientFuel,
    belowRequirement,
    exactRequirement,
    fullForce,
    beyondRangeSelection,
  })
}

export type AssertEvaluateInput = {
  state: Readonly<{
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
  actionId: ActionId
  force: ReturnType<typeof createFleetStub>
  playerId: PlayerId
  site: ReturnType<typeof createPlanetStub>
  beyondRange: ReturnType<typeof createPlanetStub>
}

export function assertSubmittedAtInsufficientInfluence({
  submittedAtInsufficientInfluence,
  submittedAtInsufficientFuel,
  submittedAtExactBudget,
  force,
  insufficientInfluence,
  insufficientFuel,
  belowRequirement,
  exactRequirement,
  fullForce,
  beyondRangeSelection,
}: AssertSubmittedAtInsufficientInfluenceInput): void {
  expect(submittedAtInsufficientInfluence.status).toBe("INELIGIBLE")
  expect(submittedAtInsufficientInfluence.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
  )
  expect(submittedAtInsufficientFuel.status).toBe("INELIGIBLE")
  expect(submittedAtInsufficientFuel.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
  )
  expect(submittedAtExactBudget.status).toBe("ELIGIBLE")
  expect(submittedAtExactBudget.resourceCommitments[ResourceType.INFLUENCE]).toBe(7)
  expect(submittedAtExactBudget.resourceCommitments[ResourceType.FUEL]).toBe(2)
  expect(submittedAtExactBudget.strengthCommitments[force.id]).toBe(30)
  expect(insufficientInfluence.status).toBe("INELIGIBLE")
  expect(insufficientInfluence.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
  )
  expect(insufficientFuel.status).toBe("INELIGIBLE")
  expect(insufficientFuel.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
  )
  expect(belowRequirement.status).toBe("INELIGIBLE")
  expect(belowRequirement.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_STRENGTH", targetTag: branded<TargetTag>("site") }),
  )
  expect(exactRequirement.status).toBe("ELIGIBLE")
  expect(exactRequirement.strengthCommitments[force.id]).toBe(30)
  expect(exactRequirement.remainingStrength[force.id]).toBe(15)
  expect(exactRequirement.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 7,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 2,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })
  expect(fullForce.status).toBe("ELIGIBLE")
  expect(fullForce.strengthCommitments[force.id]).toBe(45)
  expect(fullForce.remainingStrength[force.id]).toBe(0)
  expect(fullForce.resourceCommitments).toStrictEqual(exactRequirement.resourceCommitments)
  expect(beyondRangeSelection.status).toBe("INELIGIBLE")
  expect(beyondRangeSelection.issues).toContainEqual(
    expect.objectContaining({ code: "OUT_OF_RANGE", targetTag: branded<TargetTag>("site") }),
  )
}

export type AssertSubmittedAtInsufficientInfluenceInput = {
  submittedAtInsufficientInfluence: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  submittedAtInsufficientFuel: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  submittedAtExactBudget: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  force: ReturnType<typeof createFleetStub>
  insufficientInfluence: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  insufficientFuel: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  belowRequirement: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  exactRequirement: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  fullForce: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
  beyondRangeSelection: Readonly<{
    status: "ELIGIBLE" | "INCOMPLETE" | "INELIGIBLE"
    issues: ReadonlyArray<
      Readonly<{
        code: EligibilityIssueCode
        actionId?: ActionId
        targetTag?: TargetTag
        inputTag?: InputTag
        resourceType?: ResourceType
        message: string
      }>
    >
    missingTargets: readonly TargetTag[]
    missingInputs: readonly InputTag[]
    resourceCommitments: Readonly<ReturnType<typeof createResourcesStub>>
    strengthCommitments: Readonly<Record<FleetId, number>>
    remainingStrength: Readonly<Record<FleetId, number>>
  }>
}

export function assertEitherUpdateOrder({
  fixture,
  move15,
  colonize20,
  moveSubmission,
  occupied,
  moveDraft,
}: AssertEitherUpdateOrderInput): void {
  const eitherUpdateOrder = evaluateSubmittedActions({
    state: fixture.state,
    ruleset: fixture.ruleset,
    submissions: [move15, colonize20],
  })
  const reversedUpdateOrder = evaluateSubmittedActions({
    state: fixture.state,
    ruleset: fixture.ruleset,
    submissions: [colonize20, move15],
  })
  const overcommittedMove = evaluateSubmittedActions({
    state: fixture.state,
    ruleset: fixture.ruleset,
    submissions: [moveSubmission(16), colonize20],
  })
  const moveReplacement = evaluateActionSelection({
    state: occupied,
    ruleset: fixture.ruleset,
    draft: moveDraft(14),
  })
  const cancelMove = evaluateSubmittedActions({ state: occupied, ruleset: fixture.ruleset, submissions: [colonize20] })
  const cancelColonize = evaluateSubmittedActions({ state: occupied, ruleset: fixture.ruleset, submissions: [move15] })
  const replaceColonizeSource = evaluateActionSelection({
    state: occupied,
    ruleset: fixture.ruleset,
    draft: {
      actionId: fixture.colonizeActionId,
      selectedTargets: {
        [branded<TargetTag>("fleet")]: fixture.secondFleetId,
        [branded<TargetTag>("planet")]: fixture.destinationId,
      },
      selectedInputs: {},
    },
  })

  assertMoveReplacement({
    moveReplacement,
    fixture,
    eitherUpdateOrder,
    reversedUpdateOrder,
    overcommittedMove,
    cancelMove,
    cancelColonize,
    replaceColonizeSource,
  })
}

export type AssertEitherUpdateOrderInput = {
  fixture: {
    playerId: PlayerId
    moveActionId: ActionId
    colonizeActionId: ActionId
    secondColonizeActionId: ActionId
    fleetId: FleetId
    secondFleetId: FleetId
    originId: PlanetId
    destinationId: PlanetId
    ruleset: Ruleset
    state: Readonly<{
      gameId: GameId
      turn: number
      submittingPlayerId: PlayerId
      resources: Readonly<ReturnType<typeof createResourcesStub>>
      players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
      planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
      fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
      actions: readonly Action[]
    }>
  }
  move15: Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  colonize20: ReturnType<typeof createSubmittedActionStub>
  moveSubmission: (strength: number) => Readonly<{
    id: ActionId
    playerId: PlayerId
    actionDefinitionId: ActionDefinitionId
    selectedTargets: Readonly<Record<TargetTag, TargetId>>
    selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
  }>
  occupied: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  moveDraft: (strength: number) => Readonly<{
    actionId: ActionId
    selectedTargets: Readonly<Record<TargetTag, undefined | PlayerId | FleetId | PlanetId>>
    selectedInputs: Readonly<Record<InputTag, undefined | number>>
  }>
}
