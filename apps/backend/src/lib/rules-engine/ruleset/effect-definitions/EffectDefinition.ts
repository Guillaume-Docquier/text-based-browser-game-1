import { z } from "zod"
import { FleetBuildEffectDefinitionSchema } from "#lib/rules-engine/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { ResourceGainEffectDefinitionSchema } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinitionSchema } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinitionSchema } from "#lib/rules-engine/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"

export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>

export const EffectDefinitionSchema = z.discriminatedUnion("type", [
  ResourceLossEffectDefinitionSchema,
  ResourceGainEffectDefinitionSchema,
  VictoryEffectDefinitionSchema,
  FleetBuildEffectDefinitionSchema,
])
