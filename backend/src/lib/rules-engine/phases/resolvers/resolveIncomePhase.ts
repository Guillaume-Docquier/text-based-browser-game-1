import { resolveEffect } from "#lib/rules-engine/effects/resolveEffect.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveIncomePhase(context: PhaseContext): void {
  const incomeEffects = context.effects.getEffectsOfType(IncomeMechanic.type)
  for (const incomeEffect of incomeEffects) {
    resolveEffect(context, incomeEffect)
  }
}
