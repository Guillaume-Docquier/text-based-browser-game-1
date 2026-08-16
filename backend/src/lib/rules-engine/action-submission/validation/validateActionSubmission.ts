import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidationIssue.ts"
import type { ActionSubmissionValidator } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidator.ts"
import { validateActionDefinition } from "#lib/rules-engine/action-submission/validation/validators/validateActionDefinition.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { validateTargets } from "#lib/rules-engine/action-submission/validation/validators/validateTargets.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

const validators: ActionSubmissionValidator[] = [validateActionDefinition, validateTargets, validateCosts]

export function validateActionSubmission(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionValidationIssue[] {
  const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
  const actionDefinitionDescription =
    actionDefinition === undefined ? actionSubmission.actionDefinitionId : `${actionDefinition.id} (${actionDefinition.name})`

  const issues = validators
    .map((validator) => validator(actionSubmission, ruleset, turnState))
    .filter(Result.isSuccess) // We discard failures because they are caused by requirements checked by other validators
    .flatMap((success) => success.value)

  return issues.map(({ issue }) => ({
    issue: `Action Submission ${actionSubmission.id} for Action Definition ${actionDefinitionDescription}: ${issue}`,
  }))
}
