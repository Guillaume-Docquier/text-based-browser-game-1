import { z } from "zod"
import { FleetAssaultEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetColonizeEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinitionSchema } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"

export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>

export const EffectDefinitionSchema = z.discriminatedUnion("type", [
  ResourceLossEffectDefinitionSchema,
  ResourceGainEffectDefinitionSchema,
  VictoryEffectDefinitionSchema,
  FleetBuildEffectDefinitionSchema,
  FleetMoveEffectDefinitionSchema,
  FleetAssaultEffectDefinitionSchema,
  FleetColonizeEffectDefinitionSchema,
])
