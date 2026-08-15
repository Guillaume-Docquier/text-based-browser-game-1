import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/phases/resolvers/simplePhaseResolver.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): void {
  simplePhaseResolver(CostMechanic.type, context)
}
