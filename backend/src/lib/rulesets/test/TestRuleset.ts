import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { RulesetId } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

/**
 * To dedupe when StandardRuleset starts diverging or being unsuitable for tests
 */
export const TestRuleset: Ruleset = {
  ...StandardRuleset,
  /**
   * Stable id so that it is updated on deploy
   */
  id: RulesetId.parse("test_default"),
  name: "Test",
  isDefault: false,
}
