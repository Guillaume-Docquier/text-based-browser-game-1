import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#lib/rules-engine/ruleset-model/target-constraints/AbstractTargetConstraint.ts"
import type { TargetableEntity } from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"
import { trustedParse } from "#lib/validation/trustedParse.ts"

/**
 * Requires a target to be owned by the submitting player.
 */
export interface OwnedBySubmittingPlayerConstraint extends AbstractTargetConstraint {
  readonly type: "OWNED_BY_SUBMITTING_PLAYER"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

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
  // evaluate should live in turn-resolution?
  evaluate: ({
    target,
    submittingPlayerId,
  }: {
    constraint: OwnedBySubmittingPlayerConstraint
    target: TargetableEntity
    submittingPlayerId: PlayerId
  }): Result<TargetConstraintIssue[], TargetConstraintError> => {
    switch (target.type) {
      case TargetType.FLEET:
        if (target.playerId !== submittingPlayerId) {
          return Result.Success([{ issue: "Expected target fleet to be owned by the submitting player." }])
        }

        return Result.Success([])
      case TargetType.PLANET:
        if (target.ownerPlayerId !== submittingPlayerId) {
          return Result.Success([{ issue: "Expected target planet to be owned by the submitting player." }])
        }

        return Result.Success([])
      case TargetType.PLAYER:
        return Result.Failure({
          type: "INCOMPATIBLE_TARGET_TYPE",
          targetConstraintType: OwnedBySubmittingPlayerConstraint.type,
          targetType: target.type,
          error: "A player cannot be owned, this constraint is invalid.",
        })
    }
  },
} as const

export const OwnedBySubmittingPlayerConstraintSchema = z.object({
  type: z.literal("OWNED_BY_SUBMITTING_PLAYER"),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<OwnedBySubmittingPlayerConstraint>

type TargetConstraintIssue = Readonly<{
  issue: string
}>

type TargetConstraintError = Readonly<{
  type: string
  targetConstraintType: string
  targetType: TargetType
  error: string
}>
