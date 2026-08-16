import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"

export function reduceToEffects(actionSubmissions: ActionSubmission[], ruleset: Ruleset): Effect[] {
  return actionSubmissions.flatMap((actionSubmission) => {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    const targets = actionSubmission.targets
    const mechanics = [...actionDefinition.costs, ...actionDefinition.mechanics]

    return mechanics.map((mechanic) => Effect.fromMechanic({ mechanic, targets }))
  })
}
