import type { Result } from "@guillaume-docquier/tools-ts"
import { ResourceLossEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { simplePhaseResolver } from "game-rules/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "game-rules/turn-resolution/TurnContext.ts"

export function resolvePayCostsPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(ResourceLossEffectDefinition.type, context)
}
