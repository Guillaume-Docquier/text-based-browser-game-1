import { VictoryEffectDefinition } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"

/**
 * Build a victory effect definition.
 */
export function createVictoryEffectDefinitionStub(): VictoryEffectDefinition {
  return VictoryEffectDefinition.create()
}
