import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { ActionSubmissionValidator } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidator.ts"
import { validateActionDefinition } from "#lib/rules-engine/action-submission/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

const validators: ActionSubmissionValidator[] = [validateActionDefinition, validateTargets, validateCosts]

export function validateActionSubmissions(
  actionSubmissions: ActionSubmission[],
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionIssue[] {
  return validators
    .map((validator) => validator(actionSubmissions, ruleset, turnState))
    .filter(Result.isSuccess) // We discard failures because they are caused by requirements checked by other validators
    .flatMap((success) => success.value)
}
