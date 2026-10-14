import { branded } from "@guillaume-docquier/tools-ts"
import { expect } from "vitest"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  evaluateTargetCandidate,
} from "#shared/action-submission/evaluateActionSelection.ts"
import type { EligibilityIssueCode, TargetCandidateEvaluation } from "#shared/action-submission/selectionEvaluation.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { Action } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { FleetActionSelectionParity } from "#shared/testing/FleetActionSelectionParity.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { normalizeFleetSelectionInput } from "./evaluateActionSelection.test-support.ts"

export function assertStandardSubmission({
  firstActionId,
  fixture,
  state,
  ruleset,
  improvedOnlyPlanetId,
  secondActionId,
  improvedSubmission,
}: AssertStandardSubmissionInput): void {
  const standardSubmission = createSubmittedActionStub({
    id: firstActionId,
    playerId: fixture.playerId,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: fixture.fleetId, planet: fixture.destinationId },
    selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
  })
  const partialDraft = {
    actionId: firstActionId,
    selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId },
    selectedInputs: { [branded<InputTag>("strength")]: FleetActionSelectionParity.standardStrength },
  }
  const normalizedInput = normalizeFleetSelectionInput(state, ruleset, fixture, FleetActionSelectionParity, firstActionId)
  expect(normalizedInput).toStrictEqual(FleetActionSelectionParity.normalizedInput)
  const partialStandard = evaluateActionSelection({ state, ruleset, draft: partialDraft })

  const partialDestinationCandidate = evaluateTargetCandidate({
    state,
    ruleset,
    draft: partialDraft,
    targetTag: branded("planet"),
    targetId: fixture.destinationId,
  })
  const beyondStandardCandidate = evaluateTargetCandidate({
    state,
    ruleset,
    draft: partialDraft,
    targetTag: branded("planet"),
    targetId: improvedOnlyPlanetId,
  })
  const improvedRangeCandidate = evaluateTargetCandidate({
    state,
    ruleset,
    draft: {
      actionId: secondActionId,
      selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId },
      selectedInputs: { [branded<InputTag>("strength")]: FleetActionSelectionParity.improvedStrength },
    },
    targetTag: branded("planet"),
    targetId: improvedOnlyPlanetId,
  })

  // Act
  const evaluation = evaluateSubmittedActions({
    state,
    ruleset,
    submissions: [standardSubmission, improvedSubmission],
  })

  // Assert

  assertPartialStandard({
    partialStandard,
    partialDestinationCandidate,
    beyondStandardCandidate,
    improvedRangeCandidate,
    evaluation,
    fixture,
  })
}

export type AssertStandardSubmissionInput = {
  firstActionId: ActionId
  fixture: {
    playerId: PlayerId
    firstActionId: ActionId
    secondActionId: ActionId
    fleetId: FleetId
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
  state: {
    resources: ReturnType<typeof createResourcesStub>
    planets: Record<PlanetId, ReturnType<typeof createPlanetStub>>
    fleets: Record<FleetId, ReturnType<typeof createFleetStub>>
    actions: readonly Action[]
    gameId: GameId
    turn: number
    submittingPlayerId: PlayerId
    players: Readonly<Record<PlayerId, Readonly<{ id: PlayerId; ownerPlayerId: PlayerId }>>>
  }
  ruleset: Ruleset
  improvedOnlyPlanetId: PlanetId
  secondActionId: ActionId
  improvedSubmission: ReturnType<typeof createSubmittedActionStub>
}

export function assertPartialStandard({
  partialStandard,
  partialDestinationCandidate,
  beyondStandardCandidate,
  improvedRangeCandidate,
  evaluation,
  fixture,
}: AssertPartialStandardInput): void {
  expect(partialStandard.status).toBe(FleetActionSelectionParity.partialExpected.status)
  expect(partialStandard.missingTargets).toStrictEqual(FleetActionSelectionParity.partialExpected.missingTargets)
  expect(partialStandard.missingInputs).toStrictEqual(FleetActionSelectionParity.partialExpected.missingInputs)
  expect(partialDestinationCandidate.candidateStatus).toBe("ELIGIBLE")
  expect(partialDestinationCandidate.candidateIssues).toStrictEqual([])
  expect(beyondStandardCandidate.candidateStatus).toBe("INELIGIBLE")
  expect(beyondStandardCandidate.candidateIssues.map(({ code }) => code)).toContain("OUT_OF_RANGE")
  expect(improvedRangeCandidate.candidateStatus).toBe("ELIGIBLE")
  expect(improvedRangeCandidate.candidateIssues).toStrictEqual([])
  expect(evaluation.status).toBe(FleetActionSelectionParity.expected.status)
  expect(evaluation.issues).toStrictEqual(FleetActionSelectionParity.expected.issues)
  expect(evaluation.missingTargets).toStrictEqual(FleetActionSelectionParity.expected.missingTargets)
  expect(evaluation.missingInputs).toStrictEqual(FleetActionSelectionParity.expected.missingInputs)
  expect(evaluation.strengthCommitments[fixture.fleetId]).toBe(FleetActionSelectionParity.expected.strengthCommitment)
  expect(evaluation.remainingStrength[fixture.fleetId]).toBe(FleetActionSelectionParity.expected.remainingStrength)
  expect(evaluation.resourceCommitments).toStrictEqual({
    [ResourceType.INFLUENCE]: FleetActionSelectionParity.expected.resourceCommitments.INFLUENCE,
    [ResourceType.METAL]: FleetActionSelectionParity.expected.resourceCommitments.METAL,
    [ResourceType.FUEL]: FleetActionSelectionParity.expected.resourceCommitments.FUEL,
    [ResourceType.ENERGY]: FleetActionSelectionParity.expected.resourceCommitments.ENERGY,
    [ResourceType.COLONY]: FleetActionSelectionParity.expected.resourceCommitments.COLONY,
  })
}

export type AssertPartialStandardInput = {
  partialStandard: Readonly<{
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
  partialDestinationCandidate: TargetCandidateEvaluation
  beyondStandardCandidate: TargetCandidateEvaluation
  improvedRangeCandidate: TargetCandidateEvaluation
  evaluation: Readonly<{
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
  fixture: {
    playerId: PlayerId
    firstActionId: ActionId
    secondActionId: ActionId
    fleetId: FleetId
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
}
