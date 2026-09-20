import type { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { ResolvedTarget } from "#lib/rules-engine/ruleset-model/target-constraints/ResolvedTarget.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * The context supplied to a target constraint evaluator.
 */
export type TargetConstraintEvaluationContext<TConstraint extends TargetConstraint = TargetConstraint> = Readonly<{
  constraint: TConstraint
  target: ResolvedTarget
  targetTag: string
  submittingPlayerId: PlayerId
  turnState: ReadonlyDeep<TurnState>
  referenceTargets: Readonly<Record<string, ResolvedTarget>>
}>

/**
 * A player-facing reason a target did not satisfy a constraint.
 */
export type TargetConstraintIssue = Readonly<{
  issue: string
}>

/**
 * An evaluator failure caused by unsupported or malformed target-constraint input.
 */
export type TargetConstraintEvaluationError = Readonly<{
  type: "TARGET_CONSTRAINT_EVALUATION_ERROR"
  constraintType: TargetConstraint["type"]
  targetType: TargetType
  message: string
}>

/**
 * The common evaluator contract for every target constraint implementation.
 */
export type TargetConstraintEvaluator<TConstraint extends TargetConstraint = TargetConstraint> = (
  context: TargetConstraintEvaluationContext<TConstraint>,
) => Result<TargetConstraintIssue[], TargetConstraintEvaluationError>
