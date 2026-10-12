import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { PositiveIntegerSchema, type PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { AbstractEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/** Claims an unowned Planet when the selected Fleet has the configured Strength. */
export interface FleetColonizeEffectDefinition extends AbstractEffectDefinition {
  readonly type: "FLEET_COLONIZE"
  readonly targets: {
    readonly fleet: EffectDefinitionTargetDefinition<typeof TargetType.FLEET>
    readonly planet: EffectDefinitionTargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: {
    readonly strengthRequirement: PositiveInteger
  }
}

export const FleetColonizeEffectDefinition = {
  type: "FLEET_COLONIZE",
  create: ({ fleetTag, planetTag, strengthRequirement }: { fleetTag: string; planetTag: string; strengthRequirement: number }) =>
    typedParse(FleetColonizeEffectDefinitionSchema, {
      type: FleetColonizeEffectDefinition.type,
      targets: {
        fleet: { actionTargetTag: fleetTag, targetType: TargetType.FLEET },
        planet: { actionTargetTag: planetTag, targetType: TargetType.PLANET },
      },
      parameters: { strengthRequirement },
    }),
} as const

export const FleetColonizeEffectDefinitionSchema = z.object({
  type: z.literal(FleetColonizeEffectDefinition.type),
  targets: z.object({
    fleet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.FLEET)),
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({ strengthRequirement: PositiveIntegerSchema }).strict(),
}) satisfies z.ZodType<FleetColonizeEffectDefinition>
