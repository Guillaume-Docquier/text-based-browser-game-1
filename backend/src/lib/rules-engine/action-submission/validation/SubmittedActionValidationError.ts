import type { ActionId } from "#lib/db/actions/ActionId.ts"
import type { ActionDefinitionId } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { TargetConstraintEvaluationError } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintEvaluation.ts"

export type SubmittedActionValidationError = Readonly<{
  type: "SUBMITTED_ACTION_VALIDATION_ERROR"
  submittedActionId: ActionId
  actionDefinitionId: ActionDefinitionId
  targetTag?: string
  message: string
  cause?: TargetConstraintEvaluationError
}>

export const SubmittedActionValidationError = {
  create: ({
    submittedActionId,
    actionDefinitionId,
    targetTag,
    message,
    cause,
  }: {
    submittedActionId: ActionId
    actionDefinitionId: ActionDefinitionId
    targetTag?: string
    message: string
    cause?: TargetConstraintEvaluationError
  }): SubmittedActionValidationError => ({
    type: "SUBMITTED_ACTION_VALIDATION_ERROR",
    submittedActionId,
    actionDefinitionId,
    ...(targetTag === undefined ? {} : { targetTag }),
    message,
    ...(cause === undefined ? {} : { cause }),
  }),
}
