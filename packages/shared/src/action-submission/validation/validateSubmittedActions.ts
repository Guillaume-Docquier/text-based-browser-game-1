import { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import { validateActionDefinition } from "#shared/action-submission/validation/action-definition/validateActionDefinition.ts"
import { validateCosts } from "#shared/action-submission/validation/costs/validateCosts.ts"
import type { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import type { SubmittedActionValidator } from "#shared/action-submission/validation/SubmittedActionValidator.ts"
import { validateTargets } from "#shared/action-submission/validation/targets/validateTargets.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

const validators: SubmittedActionValidator[] = [validateActionDefinition, validateTargets, validateCosts]

export function validateSubmittedActions(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): SubmittedActionIssue[] {
  return validators
    .map((validator) => validator(submittedActions, ruleset, turnState))
    .filter(Result.isSuccess) // We discard failures because they are caused by requirements checked by other validators
    .flatMap((success) => success.value)
}
