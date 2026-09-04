import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

export function createRulesetStub({ id = v4(), ...overrides }: Partial<UnbrandedProperties<Ruleset>> = {}): Ruleset {
  return {
    id: branded(id),
    name: v4(),
    isDefault: false,
    actionDefinitions: {},
    startingResources: createResourcesStub(),
    ...overrides,
  }
}
