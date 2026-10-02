import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { createFleetBuildEffectDefinitionStub } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.stub.ts"

/**
 * Build a valid effect definition for tests.
 *
 * Concrete effect-specific builders should be used when a test depends on a particular variant.
 */
export function createEffectDefinitionStub(): EffectDefinition {
  return createFleetBuildEffectDefinitionStub()
}
