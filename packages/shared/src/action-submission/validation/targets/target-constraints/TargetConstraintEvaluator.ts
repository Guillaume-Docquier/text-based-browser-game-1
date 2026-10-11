import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { TargetableFleet, TargetablePlanet, TargetablePlayer } from "#shared/turn-resolution/TargetableEntity.ts"

type TargetsForValidation = {
  [TargetType.FLEET]: Pick<TargetableFleet, "type" | "ownerPlayerId">
  [TargetType.PLANET]: Pick<TargetablePlanet, "type" | "ownerPlayerId">
  [TargetType.PLAYER]: Pick<TargetablePlayer, "type">
}

/**
 * The entity fields needed to evaluate constraints for the selected entity type.
 */
export type TargetForValidation<TType extends TargetType = TargetType> = TargetsForValidation[TType]

/**
 * Evaluates one constraint against only its entity type.
 */
export type TargetConstraintEvaluator<TType extends TargetType, TConstraint extends TargetConstraint[TType]> = (input: {
  constraint: TConstraint
  target: TargetForValidation<TType>
  submittingPlayerId: PlayerId
}) => TargetConstraintIssue

export type TargetConstraintIssue = string | undefined
