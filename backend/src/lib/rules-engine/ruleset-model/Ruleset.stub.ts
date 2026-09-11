import { branded } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { type Ruleset, RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { trustedParse } from "#lib/validation/trustedParse.ts"

/**
 * The stub allows you to create invalid rulesets by design, mostly because tests that create rulesets often want to create invalid rulesets.
 * If you want to validate the ruleset stub to make sure you properly constructed the ruleset, use the validate argument. If the ruleset is invalid, the validation will throw.
 */
export function createRulesetStub(
  { id = v4(), ...overrides }: Partial<Parameters<typeof Ruleset.create>[0]> = {},
  validate = false,
): Ruleset {
  const ruleset = branded<Ruleset>({
    id: branded(id),
    name: v4(),
    isDefault: false,
    actionDefinitions: {},
    startingResources: createResourcesStub(),
    ...overrides,
  })

  if (validate) {
    return trustedParse(RulesetSchema, ruleset)
  }

  return ruleset
}
