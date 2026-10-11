import type { TargetConstraintEvaluator } from "#shared/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import type { PlanetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Evaluates whether the planet belongs to the submitting player.
 */
export const evaluatePlanetOwnedBySubmittingPlayerConstraint: TargetConstraintEvaluator<
  typeof TargetType.PLANET,
  PlanetOwnedBySubmittingPlayerConstraint
> = ({ target, submittingPlayerId }) => {
  if (target.ownerPlayerId !== submittingPlayerId) {
    return "Expected target planet to be owned by the submitting player."
  }

  return undefined
}
