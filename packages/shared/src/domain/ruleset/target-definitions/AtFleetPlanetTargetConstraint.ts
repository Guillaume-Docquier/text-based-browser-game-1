import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { TargetTagSchema, type TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { AbstractTargetConstraint } from "#shared/domain/ruleset/target-definitions/AbstractTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Requires the selected Planet to be the selected Fleet's stationary location.
 */
export interface AtFleetPlanetConstraint extends AbstractTargetConstraint {
  readonly type: "AT_FLEET_PLANET"
  readonly references: Readonly<{ sourceFleetTag: TargetTag }>
  readonly parameters: Readonly<Record<string, never>>
}

export const AtFleetPlanetConstraint = {
  type: "AT_FLEET_PLANET",
  supportedTargetTypes: new Set([TargetType.PLANET]),
  create: ({ sourceFleetTag }: { sourceFleetTag: string }): AtFleetPlanetConstraint =>
    typedParse(AtFleetPlanetConstraintSchema, {
      type: AtFleetPlanetConstraint.type,
      references: { sourceFleetTag },
      parameters: {},
    }),
} as const

export const AtFleetPlanetConstraintSchema = z.object({
  type: z.literal(AtFleetPlanetConstraint.type),
  references: z.object({ sourceFleetTag: TargetTagSchema }).strict(),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<AtFleetPlanetConstraint>
