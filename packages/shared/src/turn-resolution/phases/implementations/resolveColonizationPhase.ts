import { Result } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import type { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { compareArrivalProvenance, resolveFleetRebinding } from "#shared/turn-resolution/arrivalProvenance.ts"
import type { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { FleetColonizeEffect } from "#shared/turn-resolution/effects/implementations/FleetColonizeEffect.ts"
import { evaluateFleetColonizeAttempt, resolveFleetColonizeAttempt } from "#shared/turn-resolution/phases/implementations/fleetColonize.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { PendingArrivalColonizationIntent, TurnContext } from "#shared/turn-resolution/TurnContext.ts"

type ScheduledColonization =
  | Readonly<{
      kind: "standalone"
      effect: FleetColonizeEffect
      tick: number
      planetId: PlanetId
      playerId: PlayerId
      actionId: string
      departureTurn: number
      initiatingJourneyId: string
      actualFleetId: FleetId
      definitionOrdinal: number
    }>
  | Readonly<{
      kind: "arrival"
      intent: PendingArrivalColonizationIntent
      tick: number
      planetId: PlanetId
      playerId: PlayerId
      actionId: string
      departureTurn: number
      initiatingJourneyId: string
      actualFleetId: FleetId
      definitionOrdinal: number
    }>

/** Resolves tick-ordered stationary and arrival Colonize intents after Combat and Planet phases. */
export function resolveColonizationPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const standalone = context.effectPool
    .getEffectsOfType(FleetColonizeEffectDefinition.type)
    .filter((effect): effect is FleetColonizeEffect => effect instanceof FleetColonizeEffect)
    .map((effect): ScheduledColonization => ({
      kind: "standalone",
      effect,
      tick: 0,
      planetId: effect.targetPlanetId,
      playerId: effect.submittedAction.playerId,
      actionId: effect.submittedAction.id,
      departureTurn: context.turnState.turn,
      initiatingJourneyId: effect.initiatingFleetId,
      actualFleetId: resolveFleetRebinding(context.fleetIdRebindings, effect.initiatingFleetId),
      definitionOrdinal: effect.definitionOrdinal,
    }))
  const arrivals = context.pendingArrivalColonizations.map((intent): ScheduledColonization => ({
    kind: "arrival",
    intent,
    tick: intent.tick,
    planetId: intent.planetId,
    playerId: intent.submittedAction.playerId,
    actionId: intent.submittedAction.id,
    departureTurn: intent.departureTurn,
    initiatingJourneyId: intent.initiatingJourneyId,
    actualFleetId: resolveFleetRebinding(context.fleetIdRebindings, intent.actualFleetId),
    definitionOrdinal: intent.definitionOrdinal,
  }))
  const candidates = [...standalone, ...arrivals].toSorted(compareScheduledColonization)

  for (const group of Map.groupBy(candidates, (candidate) => JSON.stringify([candidate.tick, candidate.planetId])).values()) {
    const result = resolveColonizationGroup(context, group)
    if (Result.isFailure(result)) {
      return result
    }
  }

  return Result.Success(context)
}
function resolveColonizationGroup(context: TurnContext, group: readonly ScheduledColonization[]): Result<void, ResolvePhaseError> {
  const eligible: ScheduledColonization[] = []
  for (const candidate of group) {
    const result = prepareColonizationCandidate(context, candidate, eligible)
    if (Result.isFailure(result)) {
      return result
    }
  }
  const canonicalEligible = eligible.toSorted(compareArrivalProvenance)
  const orderedEligible = canonicalEligible.length > 1 ? context.rng.shuffle(canonicalEligible) : canonicalEligible
  for (const candidate of orderedEligible) {
    const result = resolveCandidate(context, candidate)
    if (Result.isFailure(result)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
  }

  return Result.Success(undefined)
}
function prepareColonizationCandidate(
  context: TurnContext,
  candidate: ScheduledColonization,
  eligible: ScheduledColonization[],
): Result<void, ResolvePhaseError> {
  const result = getCandidateEligibility(context, candidate)
  if (Result.isFailure(result)) {
    return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
  }
  if (result.value) {
    eligible.push(candidate)
    return Result.Success(undefined)
  }
  const resolved = resolveCandidate(context, candidate)
  return Result.isFailure(resolved) ? Result.Failure(ResolvePhaseError.FailedEffect({ error: resolved.error })) : Result.Success(undefined)
}

function getCandidateEligibility(
  context: TurnContext,
  candidate: ScheduledColonization,
): Result<boolean, ReturnType<typeof EffectError.Failed>> {
  const eligibility = evaluateFleetColonizeAttempt({
    context,
    submittingPlayerId: candidate.playerId,
    fleetId: candidate.actualFleetId,
    planetId: candidate.planetId,
    strengthRequirement: getStrengthRequirement(candidate),
  })
  return Result.isFailure(eligibility) ? eligibility : Result.Success(eligibility.value.eligible)
}

function getStrengthRequirement(candidate: ScheduledColonization): number {
  return candidate.kind === "standalone"
    ? candidate.effect.strengthRequirement
    : candidate.intent.effectDefinition.parameters.strengthRequirement
}

function resolveCandidate(
  context: TurnContext,
  candidate: ScheduledColonization,
): Result<EffectOutcome | undefined, ReturnType<typeof EffectError.Failed>> {
  if (candidate.kind === "standalone") {
    const result = candidate.effect.resolveAgainstFleet(context, candidate.actualFleetId)
    return Result.isFailure(result) ? result : Result.Success(result.value[0])
  }

  const result = resolveFleetColonizeAttempt({
    context,
    submittingPlayerId: candidate.intent.submittedAction.playerId,
    fleetId: candidate.actualFleetId,
    planetId: candidate.planetId,
    strengthRequirement: candidate.intent.effectDefinition.parameters.strengthRequirement,
  })
  if (Result.isFailure(result)) {
    return result
  }
  if (candidate.intent.departureTurn === context.turnState.turn) {
    context.effectPool.appendOutcomes(candidate.intent.submittedAction, [result.value])
  } else {
    candidate.intent.actionOutcomes.push(result.value)
  }
  return Result.Success(result.value)
}

function compareScheduledColonization(first: ScheduledColonization, second: ScheduledColonization): number {
  const tickOrder = first.tick - second.tick
  if (tickOrder !== 0) {
    return tickOrder
  }
  const planetOrder = compareOrdinalStrings(first.planetId, second.planetId)
  return planetOrder !== 0 ? planetOrder : compareArrivalProvenance(first, second)
}
