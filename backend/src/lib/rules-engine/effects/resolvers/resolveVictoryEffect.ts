import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { type VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveVictoryEffect(context: PhaseContext, effect: Effect<VictoryMechanic>): void {
  if (context.state.winnerPlayerId !== undefined) {
    return
  }

  context.state.winnerPlayerId = effect.targets.self
}
