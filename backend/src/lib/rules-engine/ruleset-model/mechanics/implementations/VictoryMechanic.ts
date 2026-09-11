import { z } from "zod"
import type { AbstractMechanic, NoParameters, NoTargets } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import { brand } from "#lib/validation/brand.ts"

export interface VictoryMechanic extends AbstractMechanic {
  readonly type: "VICTORY"
  readonly targets: NoTargets
  readonly parameters: NoParameters
}

export const VictoryMechanic = {
  type: "VICTORY",
  create: (): VictoryMechanic =>
    brand(VictoryMechanicSchema, {
      type: VictoryMechanic.type,
      targets: {},
      parameters: {},
    }),
} as const

export const VictoryMechanicSchema = z.object({
  type: z.literal(VictoryMechanic.type),
  targets: z.object({}),
  parameters: z.object({}),
}) satisfies z.ZodType<VictoryMechanic>
