import { Result } from "@guillaume-docquier/tools-ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

/**
 * A resolver that collects effects of a single effect definition type and resolves them with no further logic.
 */
export function simplePhaseResolver(
  effectDefinitionType: EffectDefinition["type"],
  context: TurnContext,
): Result<TurnContext, ResolvePhaseError> {
  for (const effect of context.effectPool.getEffectsOfType(effectDefinitionType)) {
    const result = effect.resolve(context)
    if (Result.isFailure(result)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
  }

  return Result.Success(context)
}
