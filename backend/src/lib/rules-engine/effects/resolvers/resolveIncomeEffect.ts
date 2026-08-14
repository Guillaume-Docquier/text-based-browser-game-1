import { Assert } from "@guillaume-docquier/tools-ts"
import type { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"

export function resolveIncomeEffect(context: PhaseContext, effect: Effect<IncomeMechanic>): void {
  const player = context.state.players[effect.targets.self]
  Assert.isDefined(player)

  const resourceCount = player.resources[effect.mechanic.resourceType]
  Assert.isDefined(resourceCount)

  player.resources[effect.mechanic.resourceType] = resourceCount + effect.mechanic.quantity
}
