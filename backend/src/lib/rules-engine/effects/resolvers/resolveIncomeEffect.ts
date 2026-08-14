import { Assert } from "@guillaume-docquier/tools-ts"
import type { IncomeEffect } from "#lib/rules-engine/effects/Effect.ts"
import { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveIncomeEffect(context: TurnContext, effect: IncomeEffect): EffectOutcome {
  const player = context.state.players[effect.targets.player]
  Assert.isDefined(player)

  const currentQuantity = player.resources[effect.resourceType]
  Assert.isDefined(currentQuantity)
  player.resources[effect.resourceType] = currentQuantity + effect.quantity

  return EffectOutcome.succeeded(effect)
}
