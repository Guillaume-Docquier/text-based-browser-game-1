import { AssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
export function createAssaultEffectDefinitionStub({ fleetTag = "fleet", planetTag = "planet" } = {}): AssaultEffectDefinition {
  return AssaultEffectDefinition.create({ fleetTag, planetTag })
}
