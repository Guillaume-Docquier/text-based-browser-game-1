import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import type {
  TargetConstraintImplementation,
  TargetConstraintImplementationRegistry,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintImplementation.ts"

/**
 * The explicit, O(1) lookup table for target constraint implementations.
 */
export const TargetConstraintImplementations = {
  [OwnedBySubmittingPlayerConstraint.type]: OwnedBySubmittingPlayerConstraint,
} satisfies TargetConstraintImplementationRegistry

/**
 * Gets the implementation corresponding to a parsed target constraint.
 */
export function getTargetConstraintImplementation<TConstraint extends TargetConstraint>(
  constraint: TConstraint,
): TargetConstraintImplementation<TConstraint> {
  const implementation = TargetConstraintImplementations[constraint.type]

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: TargetConstraintImplementationRegistry proves every discriminator is registered. The generic constraint and its discriminator are correlated at this accessor boundary.
  return implementation as unknown as TargetConstraintImplementation<TConstraint>
}
