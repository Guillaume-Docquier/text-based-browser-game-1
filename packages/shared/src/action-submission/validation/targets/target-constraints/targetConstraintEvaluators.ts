import { evaluateFleetOwnedBySubmittingPlayerConstraint } from "#shared/action-submission/validation/targets/target-constraints/fleet/evaluateFleetOwnedBySubmittingPlayerConstraint.ts"
import { evaluatePlanetOwnedBySubmittingPlayerConstraint } from "#shared/action-submission/validation/targets/target-constraints/planet/evaluatePlanetOwnedBySubmittingPlayerConstraint.ts"
import type { TargetConstraintEvaluator } from "#shared/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Requires one evaluator per discriminator within each entity's constraint set.
 */
type TargetConstraintEvaluatorRegistry = {
  readonly [TType in TargetType]: {
    readonly [TConstraintType in TargetConstraint[TType]["type"]]: TargetConstraintEvaluator<
      TType,
      Extract<TargetConstraint[TType], { type: TConstraintType }>
    >
  }
}

/**
 * Constraint discriminators are scoped to their entity type.
 */
export const targetConstraintEvaluators = {
  [TargetType.FLEET]: {
    OWNED_BY_SUBMITTING_PLAYER: evaluateFleetOwnedBySubmittingPlayerConstraint,
  },
  [TargetType.PLANET]: {
    OWNED_BY_SUBMITTING_PLAYER: evaluatePlanetOwnedBySubmittingPlayerConstraint,
  },
  [TargetType.PLAYER]: {},
} satisfies TargetConstraintEvaluatorRegistry
