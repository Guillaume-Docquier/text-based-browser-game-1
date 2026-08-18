import { Result } from "@guillaume-docquier/tools-ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { ResolvePhaseError } from "#lib/rules-engine/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#lib/rules-engine/turn-resolution/TurnContext.ts"

/**
 * A resolver that collects a single mechanic type and resolves them with no further logic.
 */
export function simplePhaseResolver(mechanicType: Mechanic["type"], context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  for (const effect of context.effectPool.getEffectsOfType(mechanicType)) {
    const outcome = effect.resolve(context)
    if (Result.isFailure(outcome)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: outcome.error }))
    }
  }

  return Result.Success(context)
}
