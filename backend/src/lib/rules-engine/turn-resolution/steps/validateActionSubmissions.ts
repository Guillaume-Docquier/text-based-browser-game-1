import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidationIssue.ts"
import { validateActionSubmission } from "#lib/rules-engine/action-submission/validation/validateActionSubmission.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

type ActionSubmissionValidities = {
  valid: ActionSubmission[]
  invalid: Array<{ actionSubmission: ActionSubmission; issues: ActionSubmissionValidationIssue[] }>
}

export function validateActionSubmissions(
  actionSubmissions: ActionSubmission[],
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionValidities {
  const valid: ActionSubmissionValidities["valid"] = []
  const invalid: ActionSubmissionValidities["invalid"] = []

  for (const actionSubmission of actionSubmissions) {
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

    if (issues.length === 0) {
      valid.push(actionSubmission)
    } else {
      invalid.push({ actionSubmission, issues })
    }
  }

  return { valid, invalid }
}
