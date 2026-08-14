import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveVictoryPhase(context: PhaseContext): void {
  const victoryEffects = context.effects.getEffectsOfType(VictoryMechanic.type)
  for (const victoryEffect of victoryEffects) {
    resolveEffect(context, victoryEffect)
  }
}
