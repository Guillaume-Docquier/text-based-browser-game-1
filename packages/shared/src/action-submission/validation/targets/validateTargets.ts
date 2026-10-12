import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { ActionValidationIssue } from "#shared/action-submission/validation/ActionValidationIssue.ts"
import { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import { validateTarget } from "#shared/action-submission/validation/targets/validateTarget.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

/**
 * Validates selections for every Action Definition target slot against its type and constraints.
 */
export function validateTargets(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): Result<SubmittedActionIssue[], string> {
  const issues: SubmittedActionIssue[] = []

  for (const submittedAction of submittedActions) {
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    if (actionDefinition === undefined) {
      return Result.Failure(
        `Cannot validate targets for action submission ${submittedAction.id}, there is no action definition ${submittedAction.actionDefinitionId}`,
      )
    }

    for (const issue of validateAction(submittedAction, actionDefinition, turnState)) {
      issues.push(SubmittedActionIssue.create({ issue, submittedAction, actionDefinitionName: actionDefinition.name }))
    }
  }

  return Result.Success(issues)
}

function validateAction(
  submittedAction: SubmittedAction,
  actionDefinition: ActionDefinition,
  turnState: ReadonlyDeep<TurnState>,
): ActionValidationIssue[] {
  const issues: ActionValidationIssue[] = []

  for (const targetTag of Object.keys(actionDefinition.targets)) {
    // Object.keys widens TargetTag to string.
    if (submittedAction.selectedTargets[branded<TargetTag>(targetTag)] === undefined) {
      issues.push({ type: "MISSING_TARGET", targetTag })
    }
  }

  for (const [targetTag, targetId] of Object.entries(submittedAction.selectedTargets)) {
    const brandedTargetTag = branded<TargetTag>(targetTag)
    const targetDefinition = actionDefinition.targets[brandedTargetTag]
    if (targetDefinition === undefined) {
      issues.push({ type: "UNEXPECTED_TARGET", targetTag })
      continue
    }

    if (targetId.length === 0) {
      issues.push({ type: "EMPTY_TARGET", targetTag, targetType: targetDefinition.targetType })
      continue
    }

    const target = TurnState.getTarget(turnState, { targetType: targetDefinition.targetType, targetId })
    if (target === undefined) {
      issues.push({ type: "UNKNOWN_TARGET", targetTag, targetType: targetDefinition.targetType, targetId })
      continue
    }

    const issue = validateTarget({ target, submittingPlayerId: submittedAction.playerId, targetDefinition })
    if (issue !== null) {
      issues.push(issue)
    }
  }

  return issues
}
