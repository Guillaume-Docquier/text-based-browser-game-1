import { Assert } from "@guillaume-docquier/tools-ts"
import type { NonCostEffect } from "#lib/rules-engine/effects/Effect.ts"
import type { EffectOutcome } from "#lib/rules-engine/effects/EffectOutcome.ts"
import { resolveIncomeEffect } from "#lib/rules-engine/effects/resolvers/resolveIncomeEffect.ts"
import { resolveVictoryEffect } from "#lib/rules-engine/effects/resolvers/resolveVictoryEffect.ts"
import { MechanicType } from "#lib/rules-engine/mechanics/MechanicType.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveEffect(context: TurnContext, effect: NonCostEffect): EffectOutcome {
  switch (effect.type) {
    case MechanicType.INCOME:
      return resolveIncomeEffect(context, effect)
    case MechanicType.VICTORY:
      return resolveVictoryEffect(context, effect)
    default:
      Assert.isExhausted(effect)
      return effect
  }
}
