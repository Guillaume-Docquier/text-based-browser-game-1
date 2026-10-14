import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { TargetTagSchema, type TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { AbstractTargetConstraint } from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Requires a destination Planet to differ from the selected source Fleet's origin.
 */
export interface DifferentFromFleetOriginConstraint extends AbstractTargetConstraint {
  readonly type: "DIFFERENT_FROM_FLEET_ORIGIN"
  readonly references: Readonly<{ sourceFleetTag: TargetTag }>
  readonly parameters: Readonly<Record<string, never>>
}

export const DifferentFromFleetOriginConstraint = {
  type: "DIFFERENT_FROM_FLEET_ORIGIN",
  supportedTargetTypes: new Set([TargetType.PLANET]),
  create: ({ sourceFleetTag }: { sourceFleetTag: string }): DifferentFromFleetOriginConstraint =>
    typedParse(DifferentFromFleetOriginConstraintSchema, {
      type: DifferentFromFleetOriginConstraint.type,
      references: { sourceFleetTag },
      parameters: {},
    }),
} as const

export const DifferentFromFleetOriginConstraintSchema = z.object({
  type: z.literal("DIFFERENT_FROM_FLEET_ORIGIN"),
  references: z.object({ sourceFleetTag: TargetTagSchema }).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<DifferentFromFleetOriginConstraint>
