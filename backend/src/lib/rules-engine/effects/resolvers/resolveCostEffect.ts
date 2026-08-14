import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

/**
 * Does not validate that the resource won't go into negative by design.
 */
export function resolveCostEffect(context: PhaseContext, effect: Effect<CostMechanic>): void {
  const player = context.state.players[effect.targets.self]
  Assert.isDefined(player)

  const resourceCount = player.resources[effect.mechanic.resourceType]
  Assert.isDefined(resourceCount)

  player.resources[effect.mechanic.resourceType] = resourceCount - effect.mechanic.quantity
}
