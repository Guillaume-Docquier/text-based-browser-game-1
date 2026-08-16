import { VictoryMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/VictoryMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/resolvers/simplePhaseResolver.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): void {
  simplePhaseResolver(VictoryMechanic.type, context)
}
