import type { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { TargetType } from "#lib/rules-engine/ruleset/effect-definitions/TargetType.ts"
import type { AbstractTargetConstraint } from "#lib/rules-engine/ruleset/target-definitions/AbstractTargetConstraint.ts"
import type { TargetableEntity } from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"

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
