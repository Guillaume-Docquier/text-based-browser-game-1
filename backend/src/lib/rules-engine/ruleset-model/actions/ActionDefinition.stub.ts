import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"

export function createActionDefinitionStub(overrides?: Partial<ActionDefinition>): ActionDefinition {
  return {
    id: "TEST_ACTION",
    name: "Test Action",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    targets: {
      self: "",
    },
    costs: [],
    mechanics: [],
    ...overrides,
  }
}
