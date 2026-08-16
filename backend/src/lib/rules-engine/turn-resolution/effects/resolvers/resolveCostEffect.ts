import { Assert } from "@guillaume-docquier/tools-ts"
import type { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import type { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveCostEffect(context: TurnContext, effect: Effect<ResourceLossMechanic>): void {
  const player = context.state.players[effect.targets.self]
  Assert.isDefined(player)

  player.resources[effect.mechanic.resourceType] -= effect.mechanic.quantity
}
