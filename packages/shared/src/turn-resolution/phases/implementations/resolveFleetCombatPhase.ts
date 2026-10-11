import { Result } from "@guillaume-docquier/tools-ts"
import { compareOrigins, compareCodePoints } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import { AssaultEffect } from "#shared/turn-resolution/effects/implementations/AssaultEffect.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

export function resolveFleetCombatPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const canonical = context.arrivalIntents
    .filter((intent) => intent.pending.type === "ASSAULT")
    .toSorted((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick
      const origin = compareOrigins(a.origin, b.origin)
      if (origin !== 0) return origin
      if (a.pending.effectIndex !== b.pending.effectIndex) return a.pending.effectIndex - b.pending.effectIndex
      return compareCodePoints(a.departureFleetId, b.departureFleetId)
    })
  for (let start = 0; start < canonical.length;) {
    const tick = canonical[start]?.tick
    let end = start + 1
    while (canonical[end]?.tick === tick && end < canonical.length) end++
    const group = canonical.slice(start, end)
    const ordered = group.length > 1 ? context.rng.shuffle(group) : group
    for (const intent of ordered) {
      const effect = new AssaultEffect(context.effectPool.getAll().length, intent.origin.submittedAction, intent)
      context.effectPool.addMany([effect])
      const result = effect.resolve(context)
      if (Result.isFailure(result)) return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
    start = end
  }
  return Result.Success(context)
}
