import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import type { ActionSubmissionValidator } from "#lib/rules-engine/actions/validation/ActionSubmissionValidator.ts"
import { validateActionDefinitions } from "#lib/rules-engine/actions/validation/validators/validateActionDefinitions.ts"
import { validateCosts } from "#lib/rules-engine/actions/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/actions/validation/validators/validateTargets.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const validators: ActionSubmissionValidator[] = [validateActionDefinitions, validateTargets, validateCosts]

export function validateActionSubmission(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): Result<ActionSubmission, ActionSubmissionValidationIssue[]> {
  const issues: ActionSubmissionValidationIssue[] = []
  for (const validator of validators) {
    issues.push(...validator(actionSubmission, ruleset, turnState))
  }

  if (issues.length > 0) {
    return Result.Failure(issues)
  }

  return Result.Success(actionSubmission)
}
