import { Result } from "@guillaume-docquier/tools-ts"
import type { DeepReadonly } from "utility-types"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import type { SubmittedActionValidator } from "#lib/rules-engine/action-submission/validation/SubmittedActionValidator.ts"
import { validateActionDefinition } from "#lib/rules-engine/action-submission/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

const validators: SubmittedActionValidator[] = [validateActionDefinition, validateTargets, validateCosts]

export function validateSubmittedActions(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: DeepReadonly<TurnState>,
): SubmittedActionIssue[] {
  return validators
    .map((validator) => validator(submittedActions, ruleset, turnState))
    .filter(Result.isSuccess) // We discard failures because they are caused by requirements checked by other validators
    .flatMap((success) => success.value)
}
