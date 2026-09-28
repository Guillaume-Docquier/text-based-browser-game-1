import { Result } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "game-rules/action-submission/Action.ts"
import type { SubmittedActionIssue } from "game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { SubmittedActionValidator } from "game-rules/action-submission/validation/SubmittedActionValidator.ts"
import { validateActionDefinition } from "game-rules/action-submission/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "game-rules/action-submission/validation/validators/validateCosts.ts"
import { validateTargets } from "game-rules/action-submission/validation/validators/validateTargets.ts"
import type { Ruleset } from "game-rules/ruleset/Ruleset.ts"
import type { TurnState } from "game-rules/turn-resolution/TurnState.ts"
import type { ReadonlyDeep } from "type-fest"

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
