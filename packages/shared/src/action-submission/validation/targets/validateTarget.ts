import { Assert } from "@guillaume-docquier/tools-ts"
import type { TargetForValidation } from "#shared/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import { targetConstraintEvaluators } from "#shared/action-submission/validation/targets/target-constraints/targetConstraintEvaluators.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Checks a resolved target against the slot's type and returns its first constraint issue.
 */
export function validateTarget({
  target,
  submittingPlayerId,
  targetDefinition,
}: {
  target: TargetForValidation
  submittingPlayerId: PlayerId
  targetDefinition: TargetDefinition
}): string | null {
  if (target.type !== targetDefinition.targetType) {
    return `Expected a ${targetDefinition.targetType} target, received ${target.type}`
  }

  switch (targetDefinition.targetType) {
    case TargetType.FLEET:
      Assert.isTrue(target.type === TargetType.FLEET)
      for (const constraint of targetDefinition.constraints) {
        const issue = targetConstraintEvaluators.FLEET[constraint.type]({ constraint, submittingPlayerId, target })
        if (issue !== undefined) {
          return issue
        }
      }
      return null
    case TargetType.PLANET:
      Assert.isTrue(target.type === TargetType.PLANET)
      for (const constraint of targetDefinition.constraints) {
        const issue = targetConstraintEvaluators.PLANET[constraint.type]({ constraint, submittingPlayerId, target })
        if (issue !== undefined) {
          return issue
        }
      }
      return null
    case TargetType.PLAYER:
      return null
  }
}
