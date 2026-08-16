import type { Result } from "@guillaume-docquier/tools-ts"
import { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import type { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/resolvers/simplePhaseResolver.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(VictoryMechanic.type, context)
}
