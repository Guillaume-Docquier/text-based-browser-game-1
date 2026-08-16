import { Result, type Success } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"

/**
 * Validates that an Action Submission references an Action Definition in the Ruleset.
 */
export function validateActionDefinition(actionSubmission: ActionSubmission, ruleset: Ruleset): Success<ActionSubmissionIssue[]> {
  if (ruleset.actionDefinitions[actionSubmission.actionDefinitionId] === undefined) {
    return Result.Success([
      ActionSubmissionIssue.create({
        issue: "Action definition does not exist in the Ruleset",
        actionSubmission,
        actionDefinitionName: undefined,
      }),
    ])
  }

  return Result.Success([])
}
