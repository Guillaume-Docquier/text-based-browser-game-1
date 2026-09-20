import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import type { TargetConstraintEvaluator } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintEvaluation.ts"

/**
 * The trusted factory contract for one target constraint implementation.
 */
export type TargetConstraintFactory<TConstraint extends TargetConstraint> = () => TConstraint

/**
 * The implementation contract shared by every target constraint.
 */
export type TargetConstraintImplementation<TConstraint extends TargetConstraint> = Readonly<{
  type: TConstraint["type"]
  supportedTargetTypes: readonly TargetType[]
  create: TargetConstraintFactory<TConstraint>
  evaluate: TargetConstraintEvaluator<TConstraint>
}>

/**
 * A statically exhaustive registry keyed by the target constraint discriminator.
 */
export type TargetConstraintImplementationRegistry = {
  [TType in TargetConstraint["type"]]: TargetConstraintImplementation<Extract<TargetConstraint, { type: TType }>>
}
