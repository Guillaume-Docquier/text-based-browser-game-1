import { Result, type Success } from "@guillaume-docquier/tools-ts"
import { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"

/**
 * Validates that an Action Submission references an Action Definition in the Ruleset.
 */
export function validateActionDefinition(submittedActions: readonly SubmittedAction[], ruleset: Ruleset): Success<SubmittedActionIssue[]> {
  return Result.Success(
    submittedActions.flatMap((submittedAction) => {
      if (ruleset.actionDefinitions[submittedAction.actionDefinitionId] === undefined) {
        return [
          SubmittedActionIssue.create({
            issue: "Action definition does not exist in the Ruleset",
            submittedAction,
            actionDefinitionName: undefined,
          }),
        ]
      }

      return []
    }),
  )
}
