import { Result } from "@guillaume-docquier/tools-ts"
import type { TargetValidationIssue } from "#shared/action-submission/validation/ActionValidationIssue.ts"
import { evaluateOwnedBySubmittingPlayerConstraint } from "#shared/action-submission/validation/targets/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.ts"
import type {
  TargetConstraintError,
  TargetConstraintIssue,
  TargetForValidation,
} from "#shared/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"

/**
 * Checks a resolved target against the slot's type and constraints.
 */
export function validateTarget({
  target,
  submittingPlayerId,
  targetDefinition,
}: {
  target: TargetForValidation
  submittingPlayerId: PlayerId
  targetDefinition: TargetDefinition
}): TargetValidationIssue | null {
  if (target.type !== targetDefinition.targetType) {
    return { type: "WRONG_TARGET_TYPE", expected: targetDefinition.targetType, received: target.type }
  }

  for (const constraint of targetDefinition.constraints) {
    const constraintValidationResult = validateConstraint({ constraint, submittingPlayerId, target })
    if (Result.isFailure(constraintValidationResult)) {
      return { type: "INVALID_TARGET_CONSTRAINT", constraintType: constraint.type, targetType: target.type }
    }

    if (constraintValidationResult.value !== undefined) {
      return constraintValidationResult.value
    }
  }

  return null
}

function validateConstraint({
  constraint,
  submittingPlayerId,
  target,
}: {
  constraint: TargetConstraint
  submittingPlayerId: PlayerId
  target: TargetForValidation
}): Result<TargetConstraintIssue, TargetConstraintError> {
  switch (constraint.type) {
    case OwnedBySubmittingPlayerConstraint.type:
      return evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })
  }
}
