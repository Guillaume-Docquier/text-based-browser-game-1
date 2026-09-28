import { FleetBuildEffectDefinitionSchema } from "game-rules/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { ResourceGainEffectDefinitionSchema } from "game-rules/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinitionSchema } from "game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinitionSchema } from "game-rules/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import { z } from "zod"

export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>

export const EffectDefinitionSchema = z.discriminatedUnion("type", [
  ResourceLossEffectDefinitionSchema,
  ResourceGainEffectDefinitionSchema,
  VictoryEffectDefinitionSchema,
  FleetBuildEffectDefinitionSchema,
])
