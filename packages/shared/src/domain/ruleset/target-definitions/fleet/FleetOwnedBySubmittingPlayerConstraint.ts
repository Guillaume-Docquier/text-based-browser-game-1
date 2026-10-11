import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"

/**
 * Requires a fleet target to be owned by the submitting player.
 */
export interface FleetOwnedBySubmittingPlayerConstraint extends AbstractTargetConstraint {
  readonly type: "OWNED_BY_SUBMITTING_PLAYER"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

/**
 * Creates the fleet ownership constraint.
 */
export const FleetOwnedBySubmittingPlayerConstraint = {
  type: "OWNED_BY_SUBMITTING_PLAYER",
  create: (): FleetOwnedBySubmittingPlayerConstraint =>
    typedParse(FleetOwnedBySubmittingPlayerConstraintSchema, {
      type: FleetOwnedBySubmittingPlayerConstraint.type,
      references: {},
      parameters: {},
    }),
} as const

export const FleetOwnedBySubmittingPlayerConstraintSchema = z.object({
  type: z.literal("OWNED_BY_SUBMITTING_PLAYER"),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<FleetOwnedBySubmittingPlayerConstraint>
