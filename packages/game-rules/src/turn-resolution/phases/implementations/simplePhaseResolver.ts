import { Result } from "@guillaume-docquier/tools-ts"
import type { EffectDefinition } from "#game-rules/ruleset/effect-definitions/EffectDefinition.ts"
import { ResolvePhaseError } from "#game-rules/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#game-rules/turn-resolution/TurnContext.ts"

/**
 * A resolver that collects effects of a single effect definition type and resolves them with no further logic.
 */
export function simplePhaseResolver(
  effectDefinitionType: EffectDefinition["type"],
  context: TurnContext,
): Result<TurnContext, ResolvePhaseError> {
  for (const effect of context.effectPool.getEffectsOfType(effectDefinitionType)) {
    const outcome = effect.resolve(context)
    if (Result.isFailure(outcome)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: outcome.error }))
    }
  }

  return Result.Success(context)
}
