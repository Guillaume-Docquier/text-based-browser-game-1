import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import type { ActionSubmissionValidator } from "#lib/rules-engine/actions/validation/ActionSubmissionValidator.ts"
import { validateActionDefinition } from "#lib/rules-engine/actions/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "#lib/rules-engine/actions/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/actions/validation/validators/validateTargets.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const validators: ActionSubmissionValidator[] = [validateActionDefinition, validateTargets, validateCosts]

export function validateActionSubmission(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionValidationIssue[] {
  return validators
    .map((validator) => validator(actionSubmission, ruleset, turnState))
    .filter(Result.isSuccess) // We discard failures because they are caused by requirements checked by other validators
    .flatMap((success) => success.value)
}
