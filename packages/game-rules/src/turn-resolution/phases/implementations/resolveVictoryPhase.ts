import type { Result } from "@guillaume-docquier/tools-ts"
import { VictoryEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import { simplePhaseResolver } from "#game-rules/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(VictoryEffectDefinition.type, context)
}
