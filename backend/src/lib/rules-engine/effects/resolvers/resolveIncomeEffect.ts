import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

export function resolveIncomeEffect(context: TurnContext, effect: Effect<IncomeMechanic>): void {
  const player = context.state.players[effect.targets.self]
  Assert.isDefined(player)

  player.resources[effect.mechanic.resourceType] += effect.mechanic.quantity
}
