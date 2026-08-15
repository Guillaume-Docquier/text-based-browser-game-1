import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): void {
  const incomeEffects = context.effects.getEffectsOfType(CostMechanic.type)
  for (const incomeEffect of incomeEffects) {
    resolveEffect(context, incomeEffect)
  }
}
