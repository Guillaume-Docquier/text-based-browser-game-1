import { Assert } from "@guillaume-docquier/tools-ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import type { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import { resolveCostEffect } from "#lib/rules-engine/turn-resolution/effects/resolvers/resolveCostEffect.ts"
import { resolveIncomeEffect } from "#lib/rules-engine/turn-resolution/effects/resolvers/resolveIncomeEffect.ts"
import { resolveVictoryEffect } from "#lib/rules-engine/turn-resolution/effects/resolvers/resolveVictoryEffect.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveEffect(context: TurnContext, effect: Effect): void {
  switch (effect.type) {
    case ResourceLossMechanic.type:
      resolveCostEffect(context, effect)
      break
    case ResourceGainMechanic.type:
      resolveIncomeEffect(context, effect)
      break
    case VictoryMechanic.type:
      resolveVictoryEffect(context, effect)
      break
    default:
      Assert.isExhausted(effect)
  }

  context.effects.markResolved(effect)
}
