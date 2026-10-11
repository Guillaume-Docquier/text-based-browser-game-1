import { Result } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveFleetBuildPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const buildEffects = context.effectPool.getEffectsOfType(FleetBuildEffectDefinition.type).toSorted((first, second) => {
    const playerOrder = compareOrdinalStrings(first.submittedAction.playerId, second.submittedAction.playerId)
    if (playerOrder !== 0) {
      return playerOrder
    }
    const actionOrder = compareOrdinalStrings(first.submittedAction.id, second.submittedAction.id)
    return actionOrder !== 0 ? actionOrder : first.definitionOrdinal - second.definitionOrdinal
  })
  for (const effect of buildEffects) {
    const result = effect.resolve(context)
    if (Result.isFailure(result)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
  }

  return Result.Success(context)
}
