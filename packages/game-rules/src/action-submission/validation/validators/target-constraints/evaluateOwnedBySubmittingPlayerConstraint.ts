import { Result } from "@guillaume-docquier/tools-ts"
import type {
  TargetConstraintError,
  TargetConstraintIssue,
} from "#game-rules/action-submission/validation/validators/target-constraints/TargetConstraintEvaluator.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetableEntity } from "#game-rules/turn-resolution/TargetableEntity.ts"

/**
 * Evaluates whether an action target belongs to the submitting player.
 */
export function evaluateOwnedBySubmittingPlayerConstraint({
  target,
  submittingPlayerId,
}: {
  constraint: OwnedBySubmittingPlayerConstraint // not used because this constraint has no parameters
  target: TargetableEntity
  submittingPlayerId: PlayerId
}): Result<TargetConstraintIssue, TargetConstraintError> {
  switch (target.type) {
    case TargetType.FLEET:
      if (target.ownerPlayerId !== submittingPlayerId) {
        return Result.Success("Expected target fleet to be owned by the submitting player.")
      }

      return Result.Success(undefined)
    case TargetType.PLANET:
      if (target.ownerPlayerId !== submittingPlayerId) {
        return Result.Success("Expected target planet to be owned by the submitting player.")
      }

      return Result.Success(undefined)
    case TargetType.PLAYER:
      return Result.Failure({
        type: "INCOMPATIBLE_TARGET_TYPE",
        targetConstraintType: OwnedBySubmittingPlayerConstraint.type,
        targetType: target.type,
        error: "A player cannot be owned, this constraint is invalid.",
      })
  }
}
