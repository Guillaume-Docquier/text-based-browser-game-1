import { v4 } from "uuid"
import { createResourcesStub } from "#lib/rules-engine/ruleset/effect-definitions/Resources.stub.ts"
import { type Ruleset, RulesetSchema } from "#lib/rules-engine/ruleset/Ruleset.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

/**
 * The stub allows you to create invalid rulesets by design, mostly because tests that create rulesets often want to create invalid rulesets.
 * If you want to validate the ruleset stub to make sure you properly constructed the ruleset, use the validate argument. If the ruleset is invalid, the validation will throw.
 */
export function createRulesetStub(overrides: Partial<Parameters<typeof Ruleset.create>[0]> = {}): Ruleset {
  return typedParse(RulesetSchema, {
    id: v4(),
    name: v4(),
    isDefault: false,
    actionDefinitions: {},
    startingResources: createResourcesStub(),
    ...overrides,
  })
}
