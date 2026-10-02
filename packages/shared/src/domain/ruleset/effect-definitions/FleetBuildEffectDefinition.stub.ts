import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"

/**
 * Build a fleet build effect definition targeting the default planet tag.
 */
export function createFleetBuildEffectDefinitionStub({
  planetTag = "planet",
  strength = 1,
}: Partial<EffectDefinitionFactoryParameters<FleetBuildEffectDefinition>> = {}): FleetBuildEffectDefinition {
  return FleetBuildEffectDefinition.create({ planetTag, strength })
}
