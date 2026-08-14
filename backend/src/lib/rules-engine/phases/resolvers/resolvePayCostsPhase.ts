import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export function resolvePayCostsPhase(context: TurnContext, actionSubmissions: ActionSubmission[], ruleset: Ruleset): void {
  const contextDraft = structuredClone(context)
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

    if (!canPayAllCosts(contextDraft, targets.self, costEffects)) {
      continue
    }

    for (const costEffect of costEffects) {
      resolveEffect(context, costEffect)
    }
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

function canPayAllCosts(context: TurnContext, playerId: string, costEffects: Array<Effect<CostMechanic>>): boolean {
  const player = context.state.players[playerId]
  Assert.isDefined(player)

  for (const costEffect of costEffects) {
    resolveEffect(context, costEffect)
  }

  return Object.values(player.resources).every((resourceCount) => resourceCount >= 0)
}
