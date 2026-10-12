import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type {
  AbstractTargetConstraint,
  NoTargetConstraintParameters,
  NoTargetReferences,
} from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/** Requires a Planet whose owner is null. */
export interface UnclaimedPlanetConstraint extends AbstractTargetConstraint {
  readonly type: "UNCLAIMED_PLANET"
  readonly references: NoTargetReferences
  readonly parameters: NoTargetConstraintParameters
}

export const UnclaimedPlanetConstraint = {
  type: "UNCLAIMED_PLANET",
  supportedTargetTypes: new Set([TargetType.PLANET]),
  create: (): UnclaimedPlanetConstraint =>
    typedParse(UnclaimedPlanetConstraintSchema, {
      type: UnclaimedPlanetConstraint.type,
      references: {},
      parameters: {},
    }),
} as const

export const UnclaimedPlanetConstraintSchema = z.object({
  type: z.literal(UnclaimedPlanetConstraint.type),
  references: z.object({}).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<UnclaimedPlanetConstraint>
