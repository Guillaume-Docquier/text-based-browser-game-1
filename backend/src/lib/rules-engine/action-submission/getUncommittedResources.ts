import { Assert } from "@guillaume-docquier/tools-ts"
import type { Action } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

/**
 * I don't like the shape of this, but it definitely lives under rules-engine/
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
      uncommittedResources[cost.resourceType] -= cost.quantity
      Assert.isTrue(uncommittedResources[cost.resourceType] >= 0)
    }
  }

  return uncommittedResources
}
