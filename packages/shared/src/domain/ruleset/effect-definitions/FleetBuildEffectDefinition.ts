import { typedParse, type Integer, IntegerSchema, type PositiveNumber, PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AbstractEffectDefinition.ts"
import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Builds a fleet of strength X on target planet.
 * If a fleet for this player is already present on the planet, that fleet is reinforced instead of adding a new fleet.
 */
export interface FleetBuildEffectDefinition extends AbstractEffectDefinition {
  readonly type: "FLEET_BUILD"
  readonly targets: {
    /**
     * The planet where the fleet should be built.
     */
    readonly planet: EffectDefinitionTargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: {
    /**
     * Non-zero positive integer representing the fleet strength to build.
     */
    readonly strength: PositiveNumber & Integer
  }
}

export const FleetBuildEffectDefinition = {
  type: "FLEET_BUILD",
  create: ({ planetTag, strength }: EffectDefinitionFactoryParameters<FleetBuildEffectDefinition>): FleetBuildEffectDefinition =>
    typedParse(FleetBuildEffectDefinitionSchema, {
      type: FleetBuildEffectDefinition.type,
      targets: {
        planet: {
          actionTargetTag: planetTag,
          targetType: TargetType.PLANET,
        },
      },
      parameters: {
        strength,
      },
    }),
} as const

export const FleetBuildEffectDefinitionSchema = z.object({
  type: z.literal(FleetBuildEffectDefinition.type),
  targets: z.object({
    planet: EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({
    strength: z.number().pipe(PositiveNumberSchema).and(IntegerSchema),
  }),
}) satisfies z.ZodType<FleetBuildEffectDefinition>
