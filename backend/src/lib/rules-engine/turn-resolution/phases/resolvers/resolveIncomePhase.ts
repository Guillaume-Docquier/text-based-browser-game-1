import { IncomeMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/IncomeMechanic.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/resolvers/simplePhaseResolver.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveIncomePhase(context: TurnContext): void {
  simplePhaseResolver(IncomeMechanic.type, context)
}
