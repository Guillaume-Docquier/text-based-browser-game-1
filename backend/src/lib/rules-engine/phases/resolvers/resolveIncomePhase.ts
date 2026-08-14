import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveIncomePhase(context: TurnContext): void {
  const incomeEffects = context.effects.getEffectsOfType(IncomeMechanic.type)
  for (const incomeEffect of incomeEffects) {
    resolveEffect(context, incomeEffect)
  }
}
