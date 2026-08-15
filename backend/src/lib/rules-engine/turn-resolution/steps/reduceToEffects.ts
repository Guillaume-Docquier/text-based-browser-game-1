import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export function reduceToEffects(actionSubmissions: ActionSubmission[], ruleset: Ruleset): Effect[] {
  return actionSubmissions.flatMap((actionSubmission) => {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    const targets = actionSubmission.targets
    const mechanics = [...actionDefinition.costs, ...actionDefinition.mechanics]

    return mechanics.map((mechanic) => Effect.fromMechanic({ mechanic, targets }))
  })
}
