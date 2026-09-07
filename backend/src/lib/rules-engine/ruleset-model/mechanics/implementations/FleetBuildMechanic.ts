import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import type { MechanicFactoryParameters } from "#lib/rules-engine/ruleset-model/mechanics/implementations/MechanicFactoryParameters.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

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
    readonly planet: TargetDefinition<typeof TargetType.PLANET>
  }
  readonly parameters: {
    /**
     * Non-zero positive integer representing the fleet strength to build.
     */
    readonly strength: number
  }
}

export const FleetBuildMechanic = {
  type: "FLEET_BUILD",
  create: ({ planetTag, strength }: MechanicFactoryParameters<FleetBuildMechanic>): FleetBuildMechanic => ({
    type: FleetBuildMechanic.type,
    targets: {
      planet: {
        tag: planetTag,
        type: TargetType.PLANET,
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
    planet: TargetDefinitionSchema(z.literal(TargetType.PLANET)),
  }),
  parameters: z.object({
    strength: z.number(),
  }),
}) satisfies z.ZodType<FleetBuildMechanic>
