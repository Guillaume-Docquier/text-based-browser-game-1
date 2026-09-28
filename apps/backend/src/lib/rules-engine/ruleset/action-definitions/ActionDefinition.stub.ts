import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

export function createActionDefinitionStub({ ...overrides }: Partial<DeepUnbranded<ActionDefinition>> = {}): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    id: "TEST_ACTION",
    name: "Test Action",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    targets: {},
    costs: [],
    effects: [],
    ...overrides,
  })
}
