import { Assert, Result } from "@guillaume-docquier/tools-ts"
import type { CostEffect } from "#lib/rules-engine/effects/Effect.ts"
import { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import { trySpendResources } from "#lib/rules-engine/mechanics/ResourceStockpile.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): void {
  const costsByPlayer = groupCostsByPlayer(context.effects.getEffectsOfType(MechanicType.COST))

  for (const [playerId, costEffects] of costsByPlayer) {
    const player = context.state.players[playerId]
    Assert.isDefined(player)

    const paymentResult = trySpendResources(player.resources, costEffects)
    if (Result.isFailure(paymentResult)) {
      const failedActionSubmissionIds = new Set(costEffects.map((effect) => effect.origin.actionSubmissionId))
      for (const costEffect of costEffects) {
        context.effects.complete(costEffect, EffectOutcome.failed(costEffect, "INSUFFICIENT_RESOURCES"))
      }
      for (const effect of context.effects.getAll()) {
        if (failedActionSubmissionIds.has(effect.origin.actionSubmissionId)) {
          context.effects.complete(effect, EffectOutcome.prevented(effect, "COST_PAYMENT_FAILED"))
        }
      }
      continue
    }

    player.resources = paymentResult.value
    for (const costEffect of costEffects) {
      context.effects.complete(costEffect, EffectOutcome.succeeded(costEffect))
    }
  }
}

function groupCostsByPlayer(costEffects: readonly CostEffect[]): ReadonlyMap<string, CostEffect[]> {
  const costsByPlayer = new Map<string, CostEffect[]>()
  for (const costEffect of costEffects) {
    const playerCosts = costsByPlayer.get(costEffect.targets.player) ?? []
    playerCosts.push(costEffect)
    costsByPlayer.set(costEffect.targets.player, playerCosts)
  }
  return new Map([...costsByPlayer].toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
}
