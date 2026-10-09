import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "#shared/domain/games/GameConfiguration.stub.ts"
import type { GameConfiguration } from "#shared/domain/games/GameConfiguration.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

/**
 * Creates settings for games backed by the independent Test Ruleset.
 */
export function createTestGameConfigurationStub(overrides: Partial<UnbrandedProperties<GameConfiguration>> = {}): GameConfiguration {
  return createGameConfigurationStub({ rulesetId: TestRuleset.id, ...overrides })
}
