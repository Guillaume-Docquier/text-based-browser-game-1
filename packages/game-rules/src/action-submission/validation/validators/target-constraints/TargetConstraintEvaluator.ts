import type { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import type { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import type { AbstractTargetConstraint } from "#game-rules/ruleset/target-definitions/AbstractTargetConstraint.ts"
import type { TargetableFleet, TargetablePlanet, TargetablePlayer } from "#game-rules/turn-resolution/TargetableEntity.ts"

/**
 * The entity fields needed to evaluate target constraints.
 */
export type TargetForValidation =
  | Pick<TargetableFleet, "type" | "ownerPlayerId">
  | Pick<TargetablePlanet, "type" | "ownerPlayerId">
  | Pick<TargetablePlayer, "type">

export type TargetConstraintEvaluator<TConstraint extends AbstractTargetConstraint> = ({
  target,
  submittingPlayerId,
}: {
  constraint: TConstraint
  target: TargetForValidation
  submittingPlayerId: PlayerId
}) => Result<TargetConstraintIssue, TargetConstraintError>

export type TargetConstraintIssue = string | undefined

export type TargetConstraintError = Readonly<{
  type: string
  targetConstraintType: string
  targetType: TargetType
  error: string
}>
