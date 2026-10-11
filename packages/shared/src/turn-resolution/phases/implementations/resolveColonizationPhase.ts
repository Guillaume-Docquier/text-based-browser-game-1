import { Result } from "@guillaume-docquier/tools-ts"
import { compareOrigins, compareCodePoints } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import type { ArrivalIntent } from "#shared/turn-resolution/ArrivalIntent.ts"
import { ColonizeEffect, evaluateColonizeIntent } from "#shared/turn-resolution/effects/implementations/ColonizeEffect.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"

/** Tick, then destination, then canonical provenance; only eligible contenders draw tie RNG. */
export function resolveColonizationPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const canonical = context.arrivalIntents
    .filter((intent) => intent.pending.type === "COLONIZE")
    .toSorted((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick
      const planet = compareCodePoints(a.destinationPlanetId, b.destinationPlanetId)
      if (planet !== 0) return planet
      const origin = compareOrigins(a.origin, b.origin)
      if (origin !== 0) return origin
      if (a.pending.effectIndex !== b.pending.effectIndex) return a.pending.effectIndex - b.pending.effectIndex
      return compareCodePoints(a.departureFleetId, b.departureFleetId)
    })
  for (let start = 0; start < canonical.length;) {
    const first = canonical[start]
    if (first === undefined) break
    let end = start + 1
    while (
      canonical[end]?.tick === first.tick &&
      canonical[end]?.destinationPlanetId === first.destinationPlanetId &&
      end < canonical.length
    )
      end++
    const eligible: ArrivalIntent[] = []
    const prevented: ArrivalIntent[] = []
    for (const intent of canonical.slice(start, end)) {
      const evaluation = evaluateColonizeIntent(context, intent)
      if (Result.isFailure(evaluation)) return Result.Failure(ResolvePhaseError.FailedEffect({ error: evaluation.error }))
      if (evaluation.value.length === 0) eligible.push(intent)
      else prevented.push(intent)
    }
    const ordered = eligible.length > 1 ? context.rng.shuffle(eligible) : eligible
    for (const intent of [...prevented, ...ordered]) {
      const effect = new ColonizeEffect(context.effectPool.getAll().length, intent.origin.submittedAction, intent)
      context.effectPool.addMany([effect])
      const result = effect.resolve(context)
      if (Result.isFailure(result)) return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
    start = end
  }
  return Result.Success(context)
}
