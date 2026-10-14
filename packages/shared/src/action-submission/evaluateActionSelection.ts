import { branded } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetId } from "#shared/domain/ruleset/target-definitions/TargetId.ts"
import type { Action, SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { evaluateProposal } from "./evaluateSelectionProposal.ts"
import { evaluateResourceBudget, evaluateStrengthBudget } from "./selectionBudgets.ts"
import {
  type ActionSelectionDraft,
  type EligibilityState,
  type SelectionEvaluation,
  type TargetCandidateEvaluation,
  type ProposedSelection,
  type MutableEvaluation,
  isFleetMoveEffectDefinition,
  getOwnRecordValue,
  createZeroResources,
  getStatus,
  compareIssues,
  uniqueSorted,
} from "./selectionEvaluation.ts"
import { validateMovementOccupancy } from "./validateMovementOccupancy.ts"

/**
 * Evaluates a draft as a replacement for that Action instance's current submission.
 */
export function evaluateActionSelection({
  state,
  ruleset,
  draft,
}: {
  state: EligibilityState
  ruleset: Ruleset
  draft: ActionSelectionDraft
}): SelectionEvaluation {
  const currentSelections = state.actions.flatMap((action) =>
    action.playerId === state.submittingPlayerId && action.selectedTargets !== null && action.id !== draft.actionId
      ? [submittedActionToProposal(action)]
      : [],
  )

  return evaluateProposals({
    state,
    ruleset,
    proposals: [...currentSelections, draftToProposal(draft)],
  })
}

/**
 * Evaluates one candidate target by substituting it into the same full selection evaluator.
 */
export function evaluateTargetCandidate({
  state,
  ruleset,
  draft,
  targetTag,
  targetId,
}: {
  state: EligibilityState
  ruleset: Ruleset
  draft: ActionSelectionDraft
  targetTag: TargetTag
  targetId: TargetId
}): TargetCandidateEvaluation {
  const evaluation = evaluateActionSelection({
    state,
    ruleset,
    draft: {
      ...draft,
      selectedTargets: { ...draft.selectedTargets, [targetTag]: targetId },
    },
  })
  const candidateIssues = evaluation.issues.filter((issue) => issue.actionId === draft.actionId && issue.targetTag === targetTag)
  const action = state.actions.find(({ id }) => id === draft.actionId)
  const actionDefinition = action === undefined ? undefined : getOwnRecordValue(ruleset.actionDefinitions, action.actionDefinitionId)
  const movementEffect = actionDefinition?.effects.find(isFleetMoveEffectDefinition)
  const needsSourceStrength = movementEffect !== undefined && targetTag === movementEffect.targets.fleet.actionTargetTag
  const hasBlankStrength =
    movementEffect !== undefined && getOwnRecordValue(draft.selectedInputs, movementEffect.inputs.strength.actionInputTag) === undefined
  if (
    needsSourceStrength &&
    hasBlankStrength &&
    evaluation.remainingStrength[branded<FleetId>(targetId)] === 0 &&
    getStatus(candidateIssues) !== "INELIGIBLE"
  ) {
    candidateIssues.push({
      code: "INSUFFICIENT_STRENGTH",
      actionId: draft.actionId,
      targetTag,
      inputTag: movementEffect.inputs.strength.actionInputTag,
      message: "No uncommitted Strength remains on the selected Fleet",
    })
  }
  const candidateStatus = getStatus(candidateIssues)

  return { ...evaluation, candidateStatus, candidateIssues }
}

/**
 * Evaluates the complete set of submitted Actions against one player's full current state.
 */
export function evaluateSubmittedActions({
  state,
  ruleset,
  submissions,
}: {
  state: EligibilityState
  ruleset: Ruleset
  submissions: readonly SubmittedAction[]
}): SelectionEvaluation {
  const duplicateIds = findDuplicates(submissions.map(({ id }) => id))
  const proposals = submissions.map(submittedActionToProposal)
  const evaluation = evaluateProposals({ state, ruleset, proposals })
  const definitionMismatches = submissions.flatMap((submission) => {
    const authorizedAction = state.actions.find(({ id }) => id === submission.id)
    if (authorizedAction === undefined || authorizedAction.actionDefinitionId === submission.actionDefinitionId) {
      return []
    }
    return [
      {
        code: "ACTION_DEFINITION_MISMATCH" as const,
        actionId: submission.id,
        message: `Action instance "${submission.id}" is bound to "${authorizedAction.actionDefinitionId}", not "${submission.actionDefinitionId}"`,
      },
    ]
  })
  if (duplicateIds.length === 0 && definitionMismatches.length === 0) {
    return evaluation
  }

  return {
    ...evaluation,
    status: "INELIGIBLE",
    issues: [
      ...evaluation.issues,
      ...definitionMismatches,
      ...duplicateIds.map((actionId) => ({
        code: "DUPLICATE_ACTION" as const,
        actionId,
        message: `Action instance "${actionId}" was submitted more than once`,
      })),
    ].toSorted(compareIssues),
  }
}

function evaluateProposals({
  state,
  ruleset,
  proposals,
}: {
  state: EligibilityState
  ruleset: Ruleset
  proposals: readonly ProposedSelection[]
}): SelectionEvaluation {
  const evaluation: MutableEvaluation = {
    issues: [],
    missingTargets: [],
    missingInputs: [],
    resourceCommitments: createZeroResources(),
    strengthCommitments: {},
  }
  const authorizedActions = new Map<ActionId, Action>()

  for (const action of state.actions) {
    if (action.playerId !== state.submittingPlayerId || authorizedActions.has(action.id)) {
      continue
    }
    authorizedActions.set(action.id, action)
  }

  validateMovementOccupancy({ state, ruleset, evaluation })

  const sortedProposals = proposals.toSorted((first, second) => compareOrdinalStrings(first.actionId, second.actionId))
  for (const proposal of sortedProposals) {
    evaluateProposal({ state, ruleset, proposal, authorizedActions, evaluation })
  }

  evaluateResourceBudget({ state, proposals: sortedProposals, authorizedActions, ruleset, evaluation })
  evaluateStrengthBudget({ state, proposals: sortedProposals, authorizedActions, ruleset, evaluation })

  const issues = evaluation.issues.toSorted(compareIssues)
  return {
    status: getStatus(issues),
    issues,
    missingTargets: uniqueSorted(evaluation.missingTargets),
    missingInputs: uniqueSorted(evaluation.missingInputs),
    resourceCommitments: evaluation.resourceCommitments,
    strengthCommitments: evaluation.strengthCommitments,
    remainingStrength: computeRemainingStrength(state, evaluation.strengthCommitments),
  }
}

function computeRemainingStrength(state: EligibilityState, commitments: Readonly<Record<FleetId, number>>): Record<FleetId, number> {
  const remaining: Record<FleetId, number> = {}
  for (const fleet of Object.values(state.fleets).toSorted((first, second) => compareOrdinalStrings(first.id, second.id))) {
    remaining[fleet.id] =
      fleet.ownerPlayerId !== state.submittingPlayerId || fleet.movement !== undefined
        ? 0
        : Math.max(0, fleet.strength - (commitments[fleet.id] ?? 0))
  }
  return remaining
}

function draftToProposal(draft: ActionSelectionDraft): ProposedSelection {
  return {
    actionId: draft.actionId,
    selectedTargets: draft.selectedTargets,
    selectedInputs: draft.selectedInputs,
  }
}

function submittedActionToProposal(submittedAction: SubmittedAction): ProposedSelection {
  return {
    actionId: submittedAction.id,
    selectedTargets: submittedAction.selectedTargets,
    selectedInputs: submittedAction.selectedInputs,
  }
}

function findDuplicates(values: readonly ActionId[]): ActionId[] {
  const seen = new Set<ActionId>()
  const duplicates = new Set<ActionId>()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates].toSorted((first, second) => compareOrdinalStrings(first, second))
}

export type {
  ActionSelectionDraft,
  EligibilityState,
  EligibilityPlanet,
  EligibilityPlayer,
  EligibilityIssueCode,
  EligibilityIssue,
  SelectionEvaluation,
  TargetCandidateEvaluation,
} from "./selectionEvaluation.ts"
