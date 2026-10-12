import { Result } from "@guillaume-docquier/tools-ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { compareArrivalProvenance, resolveFleetRebinding } from "#shared/turn-resolution/arrivalProvenance.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { FleetAssaultEffect } from "#shared/turn-resolution/effects/implementations/FleetAssaultEffect.ts"
import { resolveFleetAssaultAttempt } from "#shared/turn-resolution/phases/implementations/fleetAssault.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { PendingArrivalAssaultIntent, TurnContext } from "#shared/turn-resolution/TurnContext.ts"

type ScheduledAssault =
  | Readonly<{
      kind: "standalone"
      effect: FleetAssaultEffect
      tick: number
      playerId: string
      actionId: string
      departureTurn: number
      initiatingJourneyId: string
      definitionOrdinal: number
    }>
  | Readonly<{
      kind: "arrival"
      intent: PendingArrivalAssaultIntent
      tick: number
      playerId: string
      actionId: string
      departureTurn: number
      initiatingJourneyId: string
      definitionOrdinal: number
    }>

/**
 * Resolves all standalone and captured arrival Assaults after every movement and Build effect.
 */
export function resolveFleetCombatPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const standaloneAssaults = context.effectPool
    .getEffectsOfType(FleetAssaultEffectDefinition.type)
    .filter((effect): effect is FleetAssaultEffect => effect instanceof FleetAssaultEffect)
    .map((effect): ScheduledAssault => ({
      kind: "standalone",
      effect,
      tick: 0,
      playerId: effect.submittedAction.playerId,
      actionId: effect.submittedAction.id,
      departureTurn: context.turnState.turn,
      initiatingJourneyId: effect.initiatingFleetId,
      definitionOrdinal: effect.definitionOrdinal,
    }))
  const arrivalAssaults = context.pendingArrivalAssaults.map((intent): ScheduledAssault => ({
    kind: "arrival",
    intent,
    tick: intent.tick,
    playerId: intent.submittedAction.playerId,
    actionId: intent.submittedAction.id,
    departureTurn: intent.departureTurn,
    initiatingJourneyId: intent.initiatingJourneyId,
    definitionOrdinal: intent.definitionOrdinal,
  }))
  const candidates = [...standaloneAssaults, ...arrivalAssaults].toSorted(compareScheduledAssaults)

  for (let first = 0; first < candidates.length;) {
    let end = first + 1
    while (end < candidates.length && candidates[end]?.tick === candidates[first]?.tick) {
      end += 1
    }
    const canonicalTie = candidates.slice(first, end).toSorted(compareArrivalProvenance)
    const orderedTie = canonicalTie.length > 1 ? context.rng.shuffle(canonicalTie) : canonicalTie
    for (const candidate of orderedTie) {
      const result = resolveScheduledAssault(context, candidate)
      if (Result.isFailure(result)) {
        return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
      }
    }
    first = end
  }

  return Result.Success(context)
}

function resolveScheduledAssault(
  context: TurnContext,
  candidate: ScheduledAssault,
): Result<EffectOutcome | undefined, ReturnType<typeof EffectError.Failed>> {
  if (candidate.kind === "standalone") {
    const attackingFleetId = resolveFleetRebinding(context.fleetIdRebindings, candidate.effect.initiatingFleetId)
    const result = candidate.effect.resolveAgainstFleet(context, attackingFleetId)
    return Result.isFailure(result) ? result : Result.Success(result.value[0])
  }

  const result = resolveFleetAssaultAttempt({
    context,
    submittingPlayerId: candidate.intent.submittedAction.playerId,
    attackingFleetId: candidate.intent.actualFleetId,
    planetId: candidate.intent.planetId,
  })
  if (Result.isFailure(result)) {
    return result
  }
  if (candidate.intent.departureTurn === context.turnState.turn) {
    context.effectPool.appendOutcomes(candidate.intent.submittedAction, [result.value])
  } else {
    candidate.intent.actionOutcomes.push(result.value)
  }
  return Result.Success(undefined)
}

function compareScheduledAssaults(first: ScheduledAssault, second: ScheduledAssault): number {
  const tickOrder = first.tick - second.tick
  return tickOrder !== 0 ? tickOrder : compareArrivalProvenance(first, second)
}
