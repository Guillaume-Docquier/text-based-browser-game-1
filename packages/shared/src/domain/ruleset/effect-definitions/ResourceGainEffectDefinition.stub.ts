import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"

/**
 * Build a resource gain effect definition with a positive influence gain by default.
 */
export function createResourceGainEffectDefinitionStub({
  quantity = 1,
  resourceType = ResourceType.INFLUENCE,
}: Partial<EffectDefinitionFactoryParameters<ResourceGainEffectDefinition>> = {}): ResourceGainEffectDefinition {
  return ResourceGainEffectDefinition.create({ quantity, resourceType })
}
