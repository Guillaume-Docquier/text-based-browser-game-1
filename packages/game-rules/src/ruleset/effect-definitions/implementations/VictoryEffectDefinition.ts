import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { AbstractEffectDefinition, NoParameters, NoTargets } from "#game-rules/ruleset/effect-definitions/AbstractEffectDefinition.ts"

export interface VictoryEffectDefinition extends AbstractEffectDefinition {
  readonly type: "VICTORY"
  readonly targets: NoTargets
  readonly parameters: NoParameters
}

export const VictoryEffectDefinition = {
  type: "VICTORY",
  create: (): VictoryEffectDefinition =>
    typedParse(VictoryEffectDefinitionSchema, {
      type: VictoryEffectDefinition.type,
      targets: {},
      parameters: {},
    }),
} as const

export const VictoryEffectDefinitionSchema = z.object({
  type: z.literal(VictoryEffectDefinition.type),
  targets: z.object({}),
  parameters: z.object({}),
}) satisfies z.ZodType<VictoryEffectDefinition>
