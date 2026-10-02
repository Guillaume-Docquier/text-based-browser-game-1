import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"

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
