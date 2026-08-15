import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { type VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveVictoryEffect(context: TurnContext, effect: Effect<VictoryMechanic>): void {
  if (context.state.winnerPlayerId !== undefined) {
    return
  }

  context.state.winnerPlayerId = effect.targets.self
}
