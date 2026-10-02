import type { EffectDefinitionFactoryParameters } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionFactoryParameters.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"

export function createFleetMoveEffectDefinitionStub({
  fleetTag = "fleet",
  planetTag = "planet",
  speed = 1,
}: Partial<EffectDefinitionFactoryParameters<FleetMoveEffectDefinition>> = {}): FleetMoveEffectDefinition {
  return FleetMoveEffectDefinition.create({ fleetTag, planetTag, speed })
}
