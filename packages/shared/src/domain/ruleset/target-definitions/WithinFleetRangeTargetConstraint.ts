import { typedParse, type PositiveNumber, PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { TargetTagSchema, type TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { AbstractTargetConstraint } from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Requires a Planet to be within the configured distance of a selected source Fleet.
 */
export interface WithinFleetRangeConstraint extends AbstractTargetConstraint {
  readonly type: "WITHIN_FLEET_RANGE"
  readonly references: Readonly<{ sourceFleetTag: TargetTag }>
  readonly parameters: Readonly<{ maxDistance: PositiveNumber }>
}

export const WithinFleetRangeConstraint = {
  type: "WITHIN_FLEET_RANGE",
  supportedTargetTypes: new Set([TargetType.PLANET]),
  create: ({ sourceFleetTag, maxDistance }: { sourceFleetTag: string; maxDistance: number }): WithinFleetRangeConstraint =>
    typedParse(WithinFleetRangeConstraintSchema, {
      type: WithinFleetRangeConstraint.type,
      references: { sourceFleetTag },
      parameters: { maxDistance },
    }),
} as const

export const WithinFleetRangeConstraintSchema = z.object({
  type: z.literal("WITHIN_FLEET_RANGE"),
  references: z.object({ sourceFleetTag: TargetTagSchema }).strict(),
  parameters: z.object({ maxDistance: z.number().finite().pipe(PositiveNumberSchema) }).strict(),
}) satisfies z.ZodType<WithinFleetRangeConstraint>
