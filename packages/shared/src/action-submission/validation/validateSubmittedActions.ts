import { evaluateSubmittedActions } from "#shared/action-submission/actionEligibility.ts"
import type { ActionEligibilityState } from "#shared/action-submission/actionEligibility.ts"
import type { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
export function validateSubmittedActions(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  state: ActionEligibilityState,
): SubmittedActionIssue[] {
  return evaluateSubmittedActions({ state, ruleset, submittedActions }).flatMap(({ action, issues }) =>
    issues.map((issue) => ({
      issue: issue.message,
      submittedActionId: action.id,
      actionDefinitionId: action.actionDefinitionId,
      actionDefinitionName: ruleset.actionDefinitions[action.actionDefinitionId]?.name,
    })),
  )
}
