import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"

export function createResourceGainEffectDefinitionStub({
  quantity = 1,
  resourceType = ResourceType.INFLUENCE,
}: Partial<EffectDefinitionFactoryParameters<ResourceGainEffectDefinition>> = {}): ResourceGainEffectDefinition {
  return ResourceGainEffectDefinition.create({ quantity, resourceType })
}
