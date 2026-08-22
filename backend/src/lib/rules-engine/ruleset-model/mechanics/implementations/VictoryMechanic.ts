import z from "zod"
import type { AbstractMechanic } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"
import { TargetDefinitionSelf, TargetDefinitionSelfSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

export interface VictoryMechanic extends AbstractMechanic {
  readonly type: "VICTORY"
  readonly targets: {
    readonly player: TargetDefinitionSelf
  }
}

export const VictoryMechanic = {
  type: "VICTORY",
  create: (): VictoryMechanic => ({
    type: VictoryMechanic.type,
    targets: {
      player: TargetDefinitionSelf,
    },
  }),
} as const

export const VictoryMechanicSchema = z.object({
  type: z.literal(VictoryMechanic.type),
  targets: z.object({ player: TargetDefinitionSelfSchema }),
}) satisfies z.ZodType<VictoryMechanic>
