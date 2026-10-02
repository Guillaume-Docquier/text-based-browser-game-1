import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { type Ruleset, RulesetSchema } from "#shared/domain/ruleset/Ruleset.ts"

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
