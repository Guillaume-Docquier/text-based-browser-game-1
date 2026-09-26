import { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type {
  TargetConstraintError,
  TargetConstraintIssue,
} from "#lib/rules-engine/action-submission/validation/validators/target-constraints/TargetConstraintEvaluator.ts"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetableEntity } from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"

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
      if (target.playerId !== submittingPlayerId) {
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
