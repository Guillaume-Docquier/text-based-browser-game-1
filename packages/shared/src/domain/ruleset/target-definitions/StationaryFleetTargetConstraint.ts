import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Requires a Fleet target to be stationary and have positive Strength.
 */
export interface StationaryFleetConstraint extends AbstractTargetConstraint {
  readonly type: "STATIONARY_FLEET"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

export const StationaryFleetConstraint = {
  type: "STATIONARY_FLEET",
  supportedTargetTypes: new Set([TargetType.FLEET]),
  create: (): StationaryFleetConstraint =>
    typedParse(StationaryFleetConstraintSchema, {
      type: StationaryFleetConstraint.type,
      references: {},
      parameters: {},
    }),
} as const

export const StationaryFleetConstraintSchema = z.object({
  type: z.literal("STATIONARY_FLEET"),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<StationaryFleetConstraint>
