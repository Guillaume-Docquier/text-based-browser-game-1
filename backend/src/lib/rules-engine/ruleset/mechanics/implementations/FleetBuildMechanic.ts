import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset/mechanics/AbstractMechanic.ts"
import type { MechanicFactoryParameters } from "#lib/rules-engine/ruleset/mechanics/implementations/MechanicFactoryParameters.ts"
import {
  type MechanicTargetDefinition,
  MechanicTargetDefinitionSchema,
} from "#lib/rules-engine/ruleset/mechanics/MechanicTargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import { type Integer, IntegerSchema } from "#lib/validation/Integer.ts"
import { type PositiveNumber, PositiveNumberSchema } from "#lib/validation/PositiveNumber.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

/**
 * Builds a fleet of strength X on target planet.
 * If a fleet for this player is already present on the planet, that fleet is reinforced instead of adding a new fleet.
 */
export interface FleetBuildMechanic extends AbstractMechanic {
  readonly type: "FLEET_BUILD"
  readonly targets: {
    /**
     * The planet where the fleet should be built.
     */
    readonly planet: MechanicTargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: {
    /**
     * Non-zero positive integer representing the fleet strength to build.
     */
    readonly strength: PositiveNumber & Integer
  }
}

export const FleetBuildMechanic = {
  type: "FLEET_BUILD",
  create: ({ planetTag, strength }: MechanicFactoryParameters<FleetBuildMechanic>): FleetBuildMechanic =>
    typedParse(FleetBuildMechanicSchema, {
      type: FleetBuildMechanic.type,
      targets: {
        planet: {
          tag: planetTag,
          targetType: TargetType.PLANET,
        },
      },
      parameters: {
        strength,
      },
    }),
} as const

export const FleetBuildMechanicSchema = z.object({
  type: z.literal(FleetBuildMechanic.type),
  targets: z.object({
    planet: MechanicTargetDefinitionSchema(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({
    strength: z.number().pipe(PositiveNumberSchema).and(IntegerSchema),
  }),
}) satisfies z.ZodType<FleetBuildMechanic>
