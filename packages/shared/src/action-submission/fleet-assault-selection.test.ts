import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  evaluateTargetCandidate,
  type EligibilityState,
} from "#shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode, TargetCandidateEvaluation } from "#shared/action-submission/selectionEvaluation.ts"
import { type GameId, GameIdSchema } from "#shared/domain/games/GameId.ts"
import { type PlayerId, PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { AttackMoveTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { GainInfluence } from "#shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

describe("Move and Assault action selection", () => {
  it("should share current resource and Strength commitments across Move, Attack Move, edit, cancel, and gain effects", () => {
    expect.hasAssertions()

    const createPlayerIdSetupPhase1Result = createPlayerIdSetup()
    const { fleet, extraDestination, extraFleet, attack, gain, extraAttack } = createPlayerIdSetupPhase1Result

    const createBaseStateSetupPhase2Result = createBaseStateSetup({ ...createPlayerIdSetupPhase1Result })
    const { baseState, currentState } = createBaseStateSetupPhase2Result
    const canceledMove = evaluateSubmittedActions({
      state: baseState,
      ruleset: TestRuleset,
      submissions: [attack, gain],
    })
    const exhaustedSourceCandidate = evaluateTargetCandidate({
      state: currentState,
      ruleset: TestRuleset,
      draft: { actionId: extraAttack.id, selectedTargets: {}, selectedInputs: {} },
      targetTag: branded<TargetTag>("fleet"),
      targetId: fleet.id,
    })
    const extraCostAttempt = evaluateActionSelection({
      state: currentState,
      ruleset: TestRuleset,
      draft: {
        actionId: extraAttack.id,
        selectedTargets: {
          [branded<TargetTag>("fleet")]: extraFleet.id,
          [branded<TargetTag>("planet")]: extraDestination.id,
        },
        selectedInputs: { [branded<InputTag>("strength")]: 1 },
      },
    })

    assertGainCannotFund({
      ...createPlayerIdSetupPhase1Result,
      ...createBaseStateSetupPhase2Result,
      canceledMove,
      exhaustedSourceCandidate,
      extraCostAttempt,
    })
  })
})

function withSubmissions(
  state: EligibilityState,
  submissions: ReadonlyArray<ReturnType<typeof createSubmittedActionStub>>,
): EligibilityState {
  const submissionsById = new Map(submissions.map((submission) => [submission.id, submission]))
  return {
    ...state,
    actions: state.actions.map((action) => {
      const submission = submissionsById.get(action.id)
      return submission === undefined
        ? action
        : {
            ...action,
            selectedTargets: submission.selectedTargets,
            selectedInputs: submission.selectedInputs,
          }
    }),
  }
}

function assertGainCannotFund({
  underfundedState,
  submissions,
  submitted,
  fleet,
  editedAttack,
  editedMove,
  canceledMove,
  exhaustedSourceCandidate,
  extraCostAttempt,
  extraFleet,
}: AssertGainCannotFundInput): void {
  const gainCannotFund = evaluateSubmittedActions({
    state: underfundedState,
    ruleset: TestRuleset,
    submissions,
  })

  // Assert

  assertSubmitted({ submitted, fleet, editedAttack, editedMove, canceledMove, exhaustedSourceCandidate, extraCostAttempt })

  assertExtraCostAttempt({ extraCostAttempt, fleet, extraFleet, gainCannotFund })
}

function assertSubmitted({
  submitted,
  fleet,
  editedAttack,
  editedMove,
  canceledMove,
  exhaustedSourceCandidate,
  extraCostAttempt,
}: AssertSubmittedInput): void {
  expect(submitted.status).toBe("ELIGIBLE")
  expect(submitted.strengthCommitments[fleet.id]).toBe(50)
  expect(submitted.remainingStrength[fleet.id]).toBe(0)
  expect(submitted.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 8,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 2,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })

  expect(editedAttack.status).toBe("INELIGIBLE")
  expect(editedAttack.strengthCommitments[fleet.id]).toBe(51)
  expect(editedAttack.issues.map(({ code }) => code)).toContain("INSUFFICIENT_STRENGTH")

  expect(editedMove.status).toBe("ELIGIBLE")
  expect(editedMove.strengthCommitments[fleet.id]).toBe(49)
  expect(editedMove.remainingStrength[fleet.id]).toBe(1)
  expect(editedMove.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: 8,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 2,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  })

  expect(canceledMove.status).toBe("ELIGIBLE")
  expect(canceledMove.strengthCommitments[fleet.id]).toBe(30)
  expect(canceledMove.remainingStrength[fleet.id]).toBe(20)
  expect(canceledMove.resourceCommitments[ResourceType.INFLUENCE]).toBe(5)
  expect(canceledMove.resourceCommitments[ResourceType.FUEL]).toBe(1)

  expect({
    status: exhaustedSourceCandidate.status,
    candidateStatus: exhaustedSourceCandidate.candidateStatus,
    candidateIssues: exhaustedSourceCandidate.candidateIssues.map(({ code }) => code),
    missingTargets: exhaustedSourceCandidate.missingTargets,
    missingInputs: exhaustedSourceCandidate.missingInputs,
    strengthCommitment: exhaustedSourceCandidate.strengthCommitments[fleet.id],
    remainingStrength: exhaustedSourceCandidate.remainingStrength[fleet.id],
    resourceCommitments: exhaustedSourceCandidate.resourceCommitments,
  }).toStrictEqual({
    status: "INELIGIBLE",
    candidateStatus: "INELIGIBLE",
    candidateIssues: ["INSUFFICIENT_STRENGTH"],
    missingTargets: [branded<TargetTag>("planet")],
    missingInputs: [branded<InputTag>("strength")],
    strengthCommitment: 50,
    remainingStrength: 0,
    resourceCommitments: {
      [ResourceType.INFLUENCE]: 13,
      [ResourceType.METAL]: 0,
      [ResourceType.FUEL]: 3,
      [ResourceType.ENERGY]: 0,
      [ResourceType.COLONY]: 0,
    },
  })

  expect(extraCostAttempt.status).toBe("INELIGIBLE")
  expect(extraCostAttempt.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
  )
}

function assertExtraCostAttempt({ extraCostAttempt, fleet, extraFleet, gainCannotFund }: AssertExtraCostAttemptInput): void {
  expect(extraCostAttempt.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
  )
  expect(extraCostAttempt.strengthCommitments[fleet.id]).toBe(50)
  expect(extraCostAttempt.strengthCommitments[extraFleet.id]).toBe(1)
  expect(extraCostAttempt.resourceCommitments[ResourceType.INFLUENCE]).toBe(13)
  expect(extraCostAttempt.resourceCommitments[ResourceType.FUEL]).toBe(3)

  expect(gainCannotFund.status).toBe("INELIGIBLE")
  expect(gainCannotFund.resourceCommitments[ResourceType.INFLUENCE]).toBe(8)
  expect(gainCannotFund.resourceCommitments[ResourceType.FUEL]).toBe(2)
  expect(gainCannotFund.issues).toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
  )
  expect(gainCannotFund.issues).not.toContainEqual(
    expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
  )
}

type AssertGainCannotFundInput = {
  underfundedState: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  submitted: Readonly<{
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
  fleet: ReturnType<typeof createFleetStub>
  editedAttack: Readonly<{
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
  editedMove: Readonly<{
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
  canceledMove: Readonly<{
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
  exhaustedSourceCandidate: TargetCandidateEvaluation
  extraCostAttempt: Readonly<{
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
  extraFleet: ReturnType<typeof createFleetStub>
}

type AssertSubmittedInput = {
  submitted: Readonly<{
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
  fleet: ReturnType<typeof createFleetStub>
  editedAttack: Readonly<{
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
  editedMove: Readonly<{
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
  canceledMove: Readonly<{
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
  exhaustedSourceCandidate: TargetCandidateEvaluation
  extraCostAttempt: Readonly<{
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

type AssertExtraCostAttemptInput = {
  extraCostAttempt: Readonly<{
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
  fleet: ReturnType<typeof createFleetStub>
  extraFleet: ReturnType<typeof createFleetStub>
  gainCannotFund: Readonly<{
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

function createPlayerIdSetup(): CreatePlayerIdSetupResult {
  expect.hasAssertions()
  // Arrange
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000021")
  const origin = createPlanetStub({ id: "reservation-origin", ownerPlayerId: playerId, x: 0, y: 0 })
  const destination = createPlanetStub({ id: "reservation-destination", ownerPlayerId: null, x: 1, y: 0 })
  const fleet = createFleetStub({
    id: "reservation-fleet",
    ownerPlayerId: playerId,
    originPlanetId: origin.id,
    strength: 50,
  })
  const extraOrigin = createPlanetStub({ id: "extra-reservation-origin", ownerPlayerId: playerId, x: 20, y: 0 })
  const extraDestination = createPlanetStub({ id: "extra-reservation-destination", ownerPlayerId: null, x: 21, y: 0 })
  const extraFleet = createFleetStub({
    id: "extra-reservation-fleet",
    ownerPlayerId: playerId,
    originPlanetId: extraOrigin.id,
    strength: 10,
  })
  const move = createSubmittedActionStub({
    id: MoveFleetStandard.id + "_1",
    playerId,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: fleet.id, planet: destination.id },
    selectedInputs: { strength: 20 },
  })
  const attack = createSubmittedActionStub({
    id: AttackMoveTest.id + "_1",
    playerId,
    actionDefinitionId: AttackMoveTest.id,
    selectedTargets: { fleet: fleet.id, planet: destination.id },
    selectedInputs: { strength: 30 },
  })
  const gain = createSubmittedActionStub({
    id: GainInfluence.id + "_1",
    playerId,
    actionDefinitionId: GainInfluence.id,
  })
  const extraAttack = createAvailableActionStub({
    id: AttackMoveTest.id + "_2",
    playerId,
    actionDefinitionId: AttackMoveTest.id,
  })
  return { playerId, origin, destination, fleet, extraOrigin, extraDestination, extraFleet, move, attack, gain, extraAttack }
}

function createBaseStateSetup({
  playerId,
  origin,
  destination,
  extraOrigin,
  extraDestination,
  fleet,
  extraFleet,
  extraAttack,
  move,
  attack,
  gain,
}: CreateBaseStateSetupInput): CreateBaseStateSetupResult {
  const baseState: EligibilityState = {
    gameId: typedParse(GameIdSchema, 1),
    turn: 1,
    submittingPlayerId: playerId,
    resources: createResourcesStub({
      [ResourceType.INFLUENCE]: 8,
      [ResourceType.FUEL]: 2,
    }),
    players: indexBy("id", [{ id: playerId, ownerPlayerId: playerId }]),
    planets: indexBy("id", [origin, destination, extraOrigin, extraDestination]),
    fleets: indexBy("id", [fleet, extraFleet]),
    actions: [...computeAvailableActions({ playerIds: [playerId], ruleset: TestRuleset }), extraAttack],
  }
  const submissions = [move, attack, gain]
  const currentState = withSubmissions(baseState, submissions)
  const underfundedState: EligibilityState = {
    ...baseState,
    resources: createResourcesStub({
      [ResourceType.INFLUENCE]: 7,
      [ResourceType.FUEL]: 2,
    }),
  }

  // Act
  const submitted = evaluateSubmittedActions({
    state: baseState,
    ruleset: TestRuleset,
    submissions,
  })
  const editedAttack = evaluateActionSelection({
    state: currentState,
    ruleset: TestRuleset,
    draft: {
      actionId: attack.id,
      selectedTargets: attack.selectedTargets,
      selectedInputs: { ...attack.selectedInputs, [branded<InputTag>("strength")]: 31 },
    },
  })
  const editedMove = evaluateActionSelection({
    state: currentState,
    ruleset: TestRuleset,
    draft: {
      actionId: move.id,
      selectedTargets: move.selectedTargets,
      selectedInputs: { ...move.selectedInputs, [branded<InputTag>("strength")]: 19 },
    },
  })
  return { baseState, submissions, currentState, underfundedState, submitted, editedAttack, editedMove }
}

type CreatePlayerIdSetupResult = {
  playerId: PlayerId
  origin: ReturnType<typeof createPlanetStub>
  destination: ReturnType<typeof createPlanetStub>
  fleet: ReturnType<typeof createFleetStub>
  extraOrigin: ReturnType<typeof createPlanetStub>
  extraDestination: ReturnType<typeof createPlanetStub>
  extraFleet: ReturnType<typeof createFleetStub>
  move: ReturnType<typeof createSubmittedActionStub>
  attack: ReturnType<typeof createSubmittedActionStub>
  gain: ReturnType<typeof createSubmittedActionStub>
  extraAttack: ReturnType<typeof createAvailableActionStub>
}

type CreateBaseStateSetupInput = {
  playerId: PlayerId
  origin: ReturnType<typeof createPlanetStub>
  destination: ReturnType<typeof createPlanetStub>
  extraOrigin: ReturnType<typeof createPlanetStub>
  extraDestination: ReturnType<typeof createPlanetStub>
  fleet: ReturnType<typeof createFleetStub>
  extraFleet: ReturnType<typeof createFleetStub>
  extraAttack: ReturnType<typeof createAvailableActionStub>
  move: ReturnType<typeof createSubmittedActionStub>
  attack: ReturnType<typeof createSubmittedActionStub>
  gain: ReturnType<typeof createSubmittedActionStub>
}

type CreateBaseStateSetupResult = {
  baseState: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  submissions: Array<ReturnType<typeof createSubmittedActionStub>>
  currentState: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  underfundedState: Readonly<{
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    resources: Readonly<ReturnType<typeof createResourcesStub>>
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
    planets: Readonly<Record<PlanetId, Readonly<{ id: PlanetId; ownerPlayerId: null | PlayerId; x: number; y: number }>>>
    fleets: Readonly<Record<FleetId, ReturnType<typeof createFleetStub>>>
    actions: readonly Action[]
  }>
  submitted: Readonly<{
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
  editedAttack: Readonly<{
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
  editedMove: Readonly<{
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
