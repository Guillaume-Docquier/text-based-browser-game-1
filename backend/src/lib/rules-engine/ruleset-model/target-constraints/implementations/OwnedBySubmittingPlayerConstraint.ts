import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#lib/rules-engine/ruleset-model/target-constraints/AbstractTargetConstraint.ts"
import type { ResolvedTarget } from "#lib/rules-engine/ruleset-model/target-constraints/ResolvedTarget.ts"
import type {
  TargetConstraintEvaluationContext,
  TargetConstraintEvaluationError,
  TargetConstraintIssue,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintEvaluation.ts"
import type { TargetConstraintImplementation } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintImplementation.ts"
import { trustedParse } from "#lib/validation/trustedParse.ts"

/**
 * Requires a Fleet or Planet target to be owned by the submitting player.
 */
export interface OwnedBySubmittingPlayerConstraint extends AbstractTargetConstraint<
  "OWNED_BY_SUBMITTING_PLAYER",
  NoTargetReferences,
  NoTargetConstraintParameters
> {
  readonly type: "OWNED_BY_SUBMITTING_PLAYER"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

/**
 * The runtime parser for an owned-by-submitting-player constraint.
 */
export const OwnedBySubmittingPlayerConstraintSchema = z
  .object({
    type: z.literal("OWNED_BY_SUBMITTING_PLAYER"),
    references: z.object({}).strict(),
    parameters: z.object({}).strict(),
  })
  .strict() satisfies z.ZodType<OwnedBySubmittingPlayerConstraint>

/**
 * The owned-by-submitting-player constraint implementation.
 */
export const OwnedBySubmittingPlayerConstraint = {
  type: "OWNED_BY_SUBMITTING_PLAYER",
  supportedTargetTypes: [TargetType.FLEET, TargetType.PLANET],
  create: (): OwnedBySubmittingPlayerConstraint =>
    trustedParse(OwnedBySubmittingPlayerConstraintSchema, {
      type: OwnedBySubmittingPlayerConstraint.type,
      references: {},
      parameters: {},
    }),
  evaluate: (
    context: TargetConstraintEvaluationContext<OwnedBySubmittingPlayerConstraint>,
  ): Result<TargetConstraintIssue[], TargetConstraintEvaluationError> => evaluate(context),
} as const satisfies TargetConstraintImplementation<OwnedBySubmittingPlayerConstraint>

function evaluate(
  context: TargetConstraintEvaluationContext<OwnedBySubmittingPlayerConstraint>,
): Result<TargetConstraintIssue[], TargetConstraintEvaluationError> {
  const rawContext: unknown = context
  if (!isEvaluationContext(rawContext)) {
    return Result.Failure(
      evaluationError({
        targetType: getTargetType(rawContext),
        message: "The target constraint evaluation context is malformed.",
      }),
    )
  }

  const { constraint, target } = rawContext
  if (constraint.type !== OwnedBySubmittingPlayerConstraint.type) {
    return Result.Failure(
      evaluationError({
        targetType: getTargetType(target),
        message: "The evaluator received a different target constraint discriminator.",
      }),
    )
  }

  switch (target.type) {
    case "FLEET":
      return target.entity.playerId === rawContext.submittingPlayerId
        ? Result.Success([])
        : ownershipIssue(rawContext.targetTag, rawContext.submittingPlayerId)
    case "PLANET":
      return target.entity.ownerPlayerId === rawContext.submittingPlayerId
        ? Result.Success([])
        : ownershipIssue(rawContext.targetTag, rawContext.submittingPlayerId)
    case "PLAYER":
      return Result.Failure(
        evaluationError({
          targetType: TargetType.PLAYER,
          message: `Target constraint "${constraint.type}" does not support target type "${target.type}".`,
        }),
      )
  }
}

function ownershipIssue(targetTag: string, submittingPlayerId: string): Result<TargetConstraintIssue[], TargetConstraintEvaluationError> {
  return Result.Success([
    {
      issue: `Target "${targetTag}" is not owned by submitting player "${submittingPlayerId}".`,
    },
  ])
}

function evaluationError({
  constraintType,
  targetType,
  message,
}: Pick<TargetConstraintEvaluationError, "message"> &
  Partial<Pick<TargetConstraintEvaluationError, "constraintType" | "targetType">>): TargetConstraintEvaluationError {
  return {
    type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
    constraintType: constraintType ?? OwnedBySubmittingPlayerConstraint.type,
    targetType: targetType ?? TargetType.PLAYER,
    message,
  }
}

function isEvaluationContext(value: unknown): value is TargetConstraintEvaluationContext<OwnedBySubmittingPlayerConstraint> {
  if (!isRecord(value)) {
    return false
  }

  if (!isOwnedConstraint(value.constraint) || !isResolvedTarget(value.target)) {
    return false
  }

  if (typeof value.targetTag !== "string" || typeof value.submittingPlayerId !== "string") {
    return false
  }

  if (!isTurnState(value.turnState) || !isReferenceTargets(value.referenceTargets)) {
    return false
  }

  return true
}

function isOwnedConstraint(value: unknown): value is OwnedBySubmittingPlayerConstraint {
  if (!isRecord(value) || value.type !== OwnedBySubmittingPlayerConstraint.type) {
    return false
  }

  return isEmptyRecord(value.references) && isEmptyRecord(value.parameters)
}

function isResolvedTarget(value: unknown): value is ResolvedTarget {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false
  }

  switch (value.type) {
    case "FLEET": {
      const fleet = value.entity
      return isRecord(fleet) && typeof fleet.playerId === "string"
    }
    case "PLANET": {
      const planet = value.entity
      return isRecord(planet) && (typeof planet.ownerPlayerId === "string" || planet.ownerPlayerId === null)
    }
    case "PLAYER": {
      const player = value.entity
      return isRecord(player) && typeof player.id === "string"
    }
    default:
      return false
  }
}

function isTurnState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return isRecord(value.players) && isRecord(value.planets) && isRecord(value.fleets)
}

function isReferenceTargets(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).every((target) => isResolvedTarget(target))
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getTargetType(value: unknown): TargetType {
  if (!isRecord(value)) {
    return TargetType.PLAYER
  }

  const target = value.target
  const targetType = isRecord(target) ? target.type : value.type
  switch (targetType) {
    case TargetType.FLEET:
      return TargetType.FLEET
    case TargetType.PLANET:
      return TargetType.PLANET
    case TargetType.PLAYER:
      return TargetType.PLAYER
    default:
      return TargetType.PLAYER
  }
}
