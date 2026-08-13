import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { resolveCostEffect } from "#lib/rules-engine/effects/resolvers/resolveCostEffect.ts"
import { resolveIncomeEffect } from "#lib/rules-engine/effects/resolvers/resolveIncomeEffect.ts"
import { resolveVictoryEffect } from "#lib/rules-engine/effects/resolvers/resolveVictoryEffect.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveEffect(context: PhaseContext, effect: Effect): void {
  switch (effect.type) {
    case CostMechanic.type:
      resolveCostEffect(context, effect)
      break
    case IncomeMechanic.type:
      resolveIncomeEffect(context, effect)
      break
    case VictoryMechanic.type:
      resolveVictoryEffect(context, effect)
      break
    default:
      Assert.isExhausted(effect)
  }

  // TODO GD Maybe should be done by the resolvers themselves?
  // TODO GD We need a status too (resolved, prevented, failed, etc)
  context.effects.markResolved(effect)
}
