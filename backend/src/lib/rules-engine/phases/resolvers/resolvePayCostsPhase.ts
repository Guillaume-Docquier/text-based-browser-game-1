import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export function resolvePayCostsPhase(context: TurnContext, actionSubmissions: ActionSubmission[], ruleset: Ruleset): void {
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

    // A bit awkward that we assume all costs target self, but all action costs should probably target self, given the game design, so that's probably not a problem.
    if (!canPayAllCosts(context, targets.self, costEffects)) {
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

  const resourcesAvailable = structuredClone(player.resources)
  for (const costEffect of costEffects) {
    resourcesAvailable[costEffect.mechanic.resourceType] -= costEffect.mechanic.quantity
  }

  return Object.values(resourcesAvailable).every((resourceCount) => resourceCount >= 0)
}
