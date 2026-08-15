import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export function validateTargets(_actionSubmission: ActionSubmission, _ruleset: Ruleset): ActionSubmissionValidationIssue[] {
  return []
}
