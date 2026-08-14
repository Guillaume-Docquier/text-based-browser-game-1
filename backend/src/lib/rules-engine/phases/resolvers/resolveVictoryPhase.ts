import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): void {
  const victoryEffects = context.effects.getEffectsOfType(VictoryMechanic.type)
  for (const victoryEffect of victoryEffects) {
    resolveEffect(context, victoryEffect)
  }
}
