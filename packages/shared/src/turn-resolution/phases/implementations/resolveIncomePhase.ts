import type { Result } from "@guillaume-docquier/tools-ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { simplePhaseResolver } from "#shared/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveIncomePhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  return simplePhaseResolver(ResourceGainEffectDefinition.type, context)
}
