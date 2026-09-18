import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import type { MechanicFactoryParameters } from "#lib/rules-engine/ruleset-model/mechanics/implementations/MechanicFactoryParameters.ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { type Integer, IntegerSchema } from "#lib/validation/Integer.ts"
import { type PositiveNumber, PositiveNumberSchema } from "#lib/validation/PositiveNumber.ts"
import { trustedParse } from "#lib/validation/trustedParse.ts"

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
    readonly planet: Extract<TargetDefinition, { readonly type: typeof TargetType.PLANET }> & Readonly<{ conditions: readonly never[] }>
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
    trustedParse(FleetBuildMechanicSchema, {
      type: FleetBuildMechanic.type,
      targets: {
        planet: {
          tag: planetTag,
          type: TargetType.PLANET,
          conditions: [],
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
    planet: z.object({
      tag: z.string(),
      type: z.literal(TargetType.PLANET),
      conditions: z.array(z.never()).readonly(),
    }),
  }),
  parameters: z.object({
    strength: z.number().pipe(PositiveNumberSchema).and(IntegerSchema),
  }),
}) satisfies z.ZodType<FleetBuildMechanic>
