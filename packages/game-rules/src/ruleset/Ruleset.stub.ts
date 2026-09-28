import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { createResourcesStub } from "game-rules/ruleset/effect-definitions/Resources.stub.ts"
import { type Ruleset, RulesetSchema } from "game-rules/ruleset/Ruleset.ts"
import { typedParse } from "game-rules/validation/typedParse.ts"
import { v4 } from "uuid"

/**
 * Creates a valid Ruleset with default values and optional overrides.
 * The completed ruleset is parsed through RulesetSchema and throws if invalid.
 * Tests of invalid rulesets should construct their input directly and pass it to Ruleset.safeCreate.
 */
export function createRulesetStub(overrides: Partial<DeepUnbranded<Ruleset>> = {}): Ruleset {
  return typedParse(RulesetSchema, {
    id: v4(),
    name: v4(),
    isDefault: false,
    actionDefinitions: {},
    actionPool: [],
    startingResources: createResourcesStub(),
    ...overrides,
  })
}
