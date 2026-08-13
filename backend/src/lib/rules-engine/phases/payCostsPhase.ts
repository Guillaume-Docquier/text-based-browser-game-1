import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"
import type { Ruleset } from "#lib/ruleset/ruleset.ts"

export function payCostsPhase(context: PhaseContext, actionSubmissions: ActionSubmission[], ruleset: Ruleset): void {
  for (const actionSubmission of actionSubmissions) {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)
    const targets = actionSubmission.targets

    const costEffects = actionDefinition.costs.map((costMechanic) =>
      Effect.fromMechanic({
        mechanic: costMechanic,
        targets,
      }),
    )
    const canPay = false // Figure that out

    if (!canPay) {
      continue
    }

    // pay, then add all effects
    context.effects.addMany(
      actionDefinition.mechanics.map((mechanic) =>
        Effect.fromMechanic({
          mechanic,
          targets,
        }),
      ),
    )
  }
}
