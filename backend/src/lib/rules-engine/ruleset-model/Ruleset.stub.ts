import { v4 } from "uuid"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

export function createRulesetStub(overrides?: Partial<Ruleset>): Ruleset {
  return {
    name: v4(),
    actionDefinitions: {},
    startingResources: createResourcesStub(),
    ...overrides,
  }
}
