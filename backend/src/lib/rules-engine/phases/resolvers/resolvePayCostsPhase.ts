import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ResolvedTargets } from "#lib/rules-engine/actions/ResolvedTargets.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"
import type { Ruleset } from "#lib/ruleset/ruleset.ts"

export function resolvePayCostsPhase(context: PhaseContext, actionSubmissions: ActionSubmission[], ruleset: Ruleset): void {
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

    if (!canPayAllCosts(contextDraft, targets, costEffects)) {
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

function canPayAllCosts(context: PhaseContext, targets: Readonly<ResolvedTargets>, costEffects: Array<Effect<CostMechanic>>): boolean {
  for (const costEffect of costEffects) {
    resolveEffect(context, costEffect)
  }

  const playerDraft = context.state.players[targets.self]
  Assert.isDefined(playerDraft)

  return Object.values(playerDraft.resources).every((resourceCount) => resourceCount >= 0)
}
