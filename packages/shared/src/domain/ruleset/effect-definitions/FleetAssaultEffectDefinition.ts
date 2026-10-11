import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition, NoParameters } from "#shared/domain/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Applies the selected stationary Fleet's current Strength against enemy Fleets at a Planet.
 */
export interface FleetAssaultEffectDefinition extends AbstractEffectDefinition {
  readonly type: "FLEET_ASSAULT"
  readonly targets: {
    readonly fleet: EffectDefinitionTargetDefinition<typeof TargetType.FLEET>
    readonly planet: EffectDefinitionTargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: NoParameters
}

export const FleetAssaultEffectDefinition = {
  type: "FLEET_ASSAULT",
  create: ({ fleetTag, planetTag }: { fleetTag: string; planetTag: string }): FleetAssaultEffectDefinition =>
    typedParse(FleetAssaultEffectDefinitionSchema, {
      type: FleetAssaultEffectDefinition.type,
      targets: {
        fleet: { actionTargetTag: fleetTag, targetType: TargetType.FLEET },
        planet: { actionTargetTag: planetTag, targetType: TargetType.PLANET },
      },
      parameters: {},
    }),
} as const

export const FleetAssaultEffectDefinitionSchema = z.object({
  type: z.literal(FleetAssaultEffectDefinition.type),
  targets: z.object({
    fleet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.FLEET)),
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({}).strict(),
}) satisfies z.ZodType<FleetAssaultEffectDefinition>
