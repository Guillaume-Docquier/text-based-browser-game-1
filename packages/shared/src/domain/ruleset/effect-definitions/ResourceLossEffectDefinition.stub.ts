import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"

export function createResourceLossEffectDefinitionStub({
  quantity = 1,
  resourceType = ResourceType.INFLUENCE,
}: Partial<EffectDefinitionFactoryParameters<ResourceLossEffectDefinition>> = {}): ResourceLossEffectDefinition {
  return ResourceLossEffectDefinition.create({ quantity, resourceType })
}
