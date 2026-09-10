import { z } from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import {
  TargetDefinitionSelf,
  TargetDefinitionSelfSchema,
  type TargetDefinitionTarget,
} from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

export interface FleetBuildMechanic extends AbstractMechanic {
  readonly type: "FLEET_BUILD"
  readonly targets: {
    readonly player: TargetDefinitionSelf
    readonly planet: TargetDefinitionTarget
  }
  readonly strength: number
}

export const FleetBuildMechanic = {
  type: "FLEET_BUILD",
  create: ({ planetTag, strength }: Omit<FleetBuildMechanic, "type" | "targets"> & { planetTag: string }): FleetBuildMechanic => ({
    type: FleetBuildMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
      planet: {
        tag: planetTag,
        type: TargetType.PLANET_OWNED,
      },
    },
    strength,
  }),
} as const

export const FleetBuildMechanicSchema = z.object({
  type: z.literal(FleetBuildMechanic.type),
  strength: z.number().int().positive(),
  targets: z.object({
    player: TargetDefinitionSelfSchema,
    planet: z.object({
      tag: z.string(),
      type: z.literal(TargetType.PLANET_OWNED),
    }),
  }),
}) satisfies z.ZodType<FleetBuildMechanic>
