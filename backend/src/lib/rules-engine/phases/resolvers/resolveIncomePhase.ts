import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveIncomePhase(context: TurnContext): void {
  const incomeEffects = context.effects.getEffectsOfType(MechanicType.INCOME)
  for (const incomeEffect of incomeEffects) {
    context.effects.complete(incomeEffect, resolveEffect(context, incomeEffect))
  }
}
