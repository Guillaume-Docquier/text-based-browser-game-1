import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionDefinitionTargetsSchema } from "#lib/rules-engine/ruleset/actions/ActionDefinitionTargets.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

export function createActionDefinitionStub({
  targets = {},
  ...overrides
}: Partial<Omit<ActionDefinition, "targets"> & DeepUnbranded<Pick<ActionDefinition, "targets">>> = {}): ActionDefinition {
  return {
    id: "TEST_ACTION",
    name: "Test Action",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    targets: typedParse(ActionDefinitionTargetsSchema, targets),
    costs: [],
    mechanics: [],
    ...overrides,
  }
}
