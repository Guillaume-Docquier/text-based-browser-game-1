import type { Result } from "@guillaume-docquier/tools-ts"
import { VictoryEffectDefinition } from "#shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"
import { simplePhaseResolver } from "#shared/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveVictoryPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(VictoryEffectDefinition.type, context)
}
