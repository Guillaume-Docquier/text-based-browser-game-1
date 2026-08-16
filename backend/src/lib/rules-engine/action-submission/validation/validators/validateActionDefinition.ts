import { Result, type Success } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidationIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"

/**
 * Validates that an Action Submission references an Action Definition in the Ruleset.
 */
export function validateActionDefinition(actionSubmission: ActionSubmission, ruleset: Ruleset): Success<ActionSubmissionValidationIssue[]> {
  if (ruleset.actionDefinitions[actionSubmission.actionDefinitionId] === undefined) {
    return Result.Success([
      {
        issue: "does not exist in the Ruleset.",
      },
    ])
  }

  return Result.Success([])
}
