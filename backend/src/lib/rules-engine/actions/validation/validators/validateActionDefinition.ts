import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

/**
 * Validates that an Action Submission references an Action Definition in the Ruleset.
 */
export function validateActionDefinition(actionSubmission: ActionSubmission, ruleset: Ruleset): ActionSubmissionValidationIssue[] {
  if (ruleset.actionDefinitions[actionSubmission.actionDefinitionId] === undefined) {
    return [
      {
        issue: `Action Definition ${actionSubmission.actionDefinitionId} referenced by action ${actionSubmission.id} does not exist in the Ruleset`,
      },
    ]
  }

  return []
}
