import { Result, type Success } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import { SubmittedActionIssue } from "#game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

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
