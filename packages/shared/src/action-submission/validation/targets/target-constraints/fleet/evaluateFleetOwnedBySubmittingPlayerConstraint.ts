import type { TargetConstraintEvaluator } from "#shared/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import type { FleetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Evaluates whether the fleet belongs to the submitting player.
 */
export const evaluateFleetOwnedBySubmittingPlayerConstraint: TargetConstraintEvaluator<
  typeof TargetType.FLEET,
  FleetOwnedBySubmittingPlayerConstraint
> = ({ target, submittingPlayerId }) => {
  if (target.ownerPlayerId !== submittingPlayerId) {
    return "Expected target fleet to be owned by the submitting player."
  }

  return undefined
}
