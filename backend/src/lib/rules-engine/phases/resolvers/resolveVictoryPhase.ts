import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): void {
  const victoryEffects = context.effects.getEffectsOfType(MechanicType.VICTORY)
  for (const victoryEffect of victoryEffects) {
    context.effects.complete(victoryEffect, resolveEffect(context, victoryEffect))
  }
}
