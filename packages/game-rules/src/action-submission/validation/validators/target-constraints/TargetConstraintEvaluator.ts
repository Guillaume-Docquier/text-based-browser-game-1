import type { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "game-rules/models/PlayerId.ts"
import type { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import type { AbstractTargetConstraint } from "game-rules/ruleset/target-definitions/AbstractTargetConstraint.ts"
import type { TargetableEntity } from "game-rules/turn-resolution/TargetableEntity.ts"

export type TargetConstraintEvaluator<TConstraint extends AbstractTargetConstraint> = ({
  target,
  submittingPlayerId,
}: {
  constraint: TConstraint
  target: TargetableEntity
  submittingPlayerId: PlayerId
}) => Result<TargetConstraintIssue, TargetConstraintError>

export type TargetConstraintIssue = string | undefined

export type TargetConstraintError = Readonly<{
  type: string
  targetConstraintType: string
  targetType: TargetType
  error: string
}>
