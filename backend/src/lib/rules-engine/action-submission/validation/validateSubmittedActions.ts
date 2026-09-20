import { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import type { SubmittedActionValidationError } from "#lib/rules-engine/action-submission/validation/SubmittedActionValidationError.ts"
import { validateActionDefinition } from "#lib/rules-engine/action-submission/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export function validateSubmittedActions(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): Result<SubmittedActionIssue[], SubmittedActionValidationError> {
  const actionDefinitionResult = validateActionDefinition(submittedActions, ruleset)

  const knownDefinitionSubmittedActions = submittedActions.filter(
    (submittedAction) => ruleset.actionDefinitions[submittedAction.actionDefinitionId] !== undefined,
  )
  const issues = [...actionDefinitionResult.value]

  for (const validator of [validateTargets, validateCosts]) {
    const validationResult = validator(knownDefinitionSubmittedActions, ruleset, turnState)
    if (Result.isFailure(validationResult)) {
      return Result.Failure(validationResult.error)
    }

    issues.push(...validationResult.value)
  }

  return Result.Success(issues)
}
