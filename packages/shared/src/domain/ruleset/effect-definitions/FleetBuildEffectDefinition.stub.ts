import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"

export function createFleetBuildEffectDefinitionStub({
  planetTag = "planet",
  strength = 1,
}: Partial<EffectDefinitionFactoryParameters<FleetBuildEffectDefinition>> = {}): FleetBuildEffectDefinition {
  return FleetBuildEffectDefinition.create({ planetTag, strength })
}
