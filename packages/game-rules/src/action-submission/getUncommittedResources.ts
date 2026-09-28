import { Assert } from "@guillaume-docquier/tools-ts"
import type { Action } from "#game-rules/action-submission/Action.ts"
import type { Resources } from "#game-rules/ruleset/effect-definitions/Resources.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"

/**
 * I don't like the shape of this, but it belongs with action submission rules.
 *
 * Computes the uncommitted resources based on the given actions and the available resources.
 * resources is only read, not mutated.
 *
 * This assumes the actions are valid for the ruleset, and that all actions can be paid.
 * If the uncommitted resources are negative, this will throw.
 */
export function getUncommittedResources({
  resources,
  actions,
  ruleset,
}: {
  resources: Readonly<Resources>
  actions: Array<Pick<Action, "actionDefinitionId">>
  ruleset: Ruleset
}): Resources {
  const uncommittedResources = { ...resources }

  for (const action of actions) {
    const actionDefinition = ruleset.actionDefinitions[action.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    for (const cost of actionDefinition.costs) {
      uncommittedResources[cost.parameters.resourceType] -= cost.parameters.quantity
      Assert.isTrue(uncommittedResources[cost.parameters.resourceType] >= 0)
    }
  }

  return uncommittedResources
}
