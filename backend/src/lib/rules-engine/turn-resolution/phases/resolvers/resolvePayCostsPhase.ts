import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/resolvers/simplePhaseResolver.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): void {
  simplePhaseResolver(ResourceLossMechanic.type, context)
}
