import type { VictoryEffect } from "#lib/rules-engine/effects/Effect.ts"
import { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveVictoryEffect(context: TurnContext, effect: VictoryEffect): EffectOutcome {
  if (context.state.winnerPlayerId !== undefined) {
    return EffectOutcome.prevented(effect, "WINNER_ALREADY_SELECTED")
  }

  context.state.winnerPlayerId = effect.targets.player
  return EffectOutcome.succeeded(effect)
}
