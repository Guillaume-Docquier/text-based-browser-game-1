import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

/**
 * Does not validate that the resource won't go into negative by design.
 */
export function resolveCostEffect(context: TurnContext, effect: Effect<CostMechanic>): void {
  const player = context.state.players[effect.targets.self]
  Assert.isDefined(player)

  player.resources[effect.mechanic.resourceType] -= effect.mechanic.quantity
}
