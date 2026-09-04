import { v4 } from "uuid"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { RulesetId, type Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

export function createRulesetStub(overrides?: Partial<Ruleset>): Ruleset {
  return {
    id: RulesetId.parse(v4()),
    name: v4(),
    isDefault: false,
    actionDefinitions: {},
    startingResources: createResourcesStub(),
    ...overrides,
  }
}
