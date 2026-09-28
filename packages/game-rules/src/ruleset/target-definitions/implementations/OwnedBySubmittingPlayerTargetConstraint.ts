import { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "game-rules/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { typedParse } from "game-rules/validation/typedParse.ts"
import { z } from "zod"

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
  supportedTargetTypes: new Set([TargetType.FLEET, TargetType.PLANET]),
  create: (): OwnedBySubmittingPlayerConstraint =>
    typedParse(OwnedBySubmittingPlayerConstraintSchema, {
      type: OwnedBySubmittingPlayerConstraint.type,
      references: {},
      parameters: {},
    }),
} as const

export const OwnedBySubmittingPlayerConstraintSchema = z.object({
  type: z.literal("OWNED_BY_SUBMITTING_PLAYER"),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<OwnedBySubmittingPlayerConstraint>
