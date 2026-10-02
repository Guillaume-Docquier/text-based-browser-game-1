import type { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { AbstractTargetConstraint } from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { TargetableFleet, TargetablePlanet, TargetablePlayer } from "#shared/turn-resolution/TargetableEntity.ts"

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
