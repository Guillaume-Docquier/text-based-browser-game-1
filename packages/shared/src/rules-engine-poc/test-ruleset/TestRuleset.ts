import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { RulesetInput } from "../definitions/RulesetDefinition.ts"
import { buildActions } from "./actions/build-fleet.ts"
import { resourceActions } from "./actions/gain-resources.ts"
import { moveActions } from "./actions/move-fleet.ts"
import { winAction } from "./actions/win-the-game.ts"

const [influence, metal, fuel, energy] = resourceActions
const actions = [influence, winAction, energy, fuel, metal, ...buildActions, ...moveActions]
/**
 * Independent data-only reproduction. Serialized JSON follows the exact same
 * compiler path as trusted TypeScript authoring.
 */
export const TestRuleset = {
  id: "test_default",
  name: "Test",
  isDefault: false,
  actionDefinitions: actions,
  actionPool: actions.map((action) => ({ id: `${action.id}_1`, actionDefinitionId: action.id })),
  startingResources: {
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
  },
} satisfies RulesetInput
