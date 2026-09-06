import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import { TargetDefinitionSelf, TargetDefinitionSelfSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface FleetBuildMechanic extends AbstractMechanic {
  readonly type: "FLEET_BUILD"
  readonly strength: number
  readonly targets: {
    readonly player: TargetDefinitionSelf
    readonly planet: {
      readonly tag: "planet"
      readonly type: "PLANET"
    }
  }
}

export const FleetBuildMechanic = {
  type: "FLEET_BUILD",
  create: ({ strength }: Pick<FleetBuildMechanic, "strength">): FleetBuildMechanic => ({
    type: FleetBuildMechanic.type,
    strength,
    targets: {
      player: TargetDefinitionSelf,
      planet: {
        tag: "planet",
        type: "PLANET",
      },
    },
  }),
} as const

export const FleetBuildMechanicSchema = z.object({
  type: z.literal(FleetBuildMechanic.type),
  strength: z.number().int().positive(),
  targets: z.object({
    player: TargetDefinitionSelfSchema,
    planet: z.object({
      tag: z.literal("planet"),
      type: z.literal("PLANET"),
    }),
  }),
}) satisfies z.ZodType<FleetBuildMechanic>
