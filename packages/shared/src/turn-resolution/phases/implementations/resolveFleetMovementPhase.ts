import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetMovement } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { resolveFleetRebinding } from "#shared/turn-resolution/arrivalProvenance.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { resolveTargetId } from "#shared/turn-resolution/effects/resolveTargetId.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { PendingArrivalAssaultIntent, PendingArrivalColonizationIntent, TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

const MOVEMENT_TICKS = 20

type JourneyAdvance = {
  fleet: ResolutionFleet
  movement: FleetMovement
  outcomes: EffectOutcome[]
  wasContinuation: boolean
}

/**
 * Allocates every new departure first, then advances and resolves all journeys once.
 */
export function resolveFleetMovementPhase(context: TurnContext): Result<TurnContext, ResolvePhaseError> {
  const departureEffects = context.effectPool.getEffectsOfType(FleetMoveEffectDefinition.type).toSorted(compareEffects)

  for (const effect of departureEffects) {
    const result = effect.resolve(context)
    if (Result.isFailure(result)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: result.error }))
    }
  }

  const previousJourneys = new Set(context.previousJourneyFleetIds)
  const journeyIds = [...new Set([...context.previousJourneyFleetIds, ...context.newDepartureFleetIds])].toSorted((first, second) =>
    compareOrdinalStrings(first, second),
  )
  const advances: JourneyAdvance[] = []
  const arrivals: JourneyAdvance[] = []

  for (const fleetId of journeyIds) {
    const result = advanceJourney(context, fleetId, previousJourneys.has(fleetId))
    if (Result.isFailure(result)) {
      return result
    }
    advances.push(result.value)
    if (result.value.fleet.distanceToEnd === 0) {
      arrivals.push(result.value)
    }
  }
  arrivals.sort((first, second) => {
    const tickOrder = (first.fleet.arrivedAtTick ?? 0) - (second.fleet.arrivedAtTick ?? 0)
    if (tickOrder !== 0) {
      return tickOrder
    }
    return compareOrdinalStrings(first.fleet.id, second.fleet.id)
  })
  const arrivalsResult = resolveArrivals(context, arrivals)
  if (Result.isFailure(arrivalsResult)) {
    return arrivalsResult
  }

  for (const advance of advances) {
    recordAdvance(context, advance, advance.movement)
  }

  context.resolvedContinuations.sort(compareContinuations)

  return Result.Success(context)
}
function compareContinuations(
  first: TurnContext["resolvedContinuations"][number],
  second: TurnContext["resolvedContinuations"][number],
): number {
  const playerOrder = compareOrdinalStrings(first.originatingSubmission.playerId, second.originatingSubmission.playerId)
  if (playerOrder !== 0) {
    return playerOrder
  }
  const actionOrder = compareOrdinalStrings(first.originatingSubmission.id, second.originatingSubmission.id)
  if (actionOrder !== 0) {
    return actionOrder
  }
  return first.departureTurn - second.departureTurn
}
function resolveArrivals(context: TurnContext, arrivals: readonly JourneyAdvance[]): Result<void, ResolvePhaseError> {
  for (const arrival of arrivals) {
    const settleResult = settleArrival(context, arrival)
    if (Result.isFailure(settleResult)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: settleResult.error }))
    }
    arrival.outcomes.push(settleResult.value)
    const queueResult = queueArrivalEffects(context, arrival)
    if (Result.isFailure(queueResult)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: queueResult.error }))
    }
  }
  return Result.Success(undefined)
}
function advanceJourney(context: TurnContext, fleetId: FleetId, wasContinuation: boolean): Result<JourneyAdvance, ResolvePhaseError> {
  const fleet = context.turnState.fleets[fleetId]
  if (fleet === undefined) {
    return movementFailure(`In-transit Fleet "${fleetId}" is missing from the turn state`)
  }
  const movement = fleet.movement
  if (movement === undefined || fleet.destinationPlanetId === undefined || fleet.distanceToEnd === undefined) {
    return movementFailure(`Fleet "${fleetId}" has incomplete in-transit data`)
  }
  const destinationPlanet = context.turnState.planets[fleet.destinationPlanetId]
  if (destinationPlanet === undefined) {
    return movementFailure(`Fleet "${fleetId}" has an unknown destination Planet "${fleet.destinationPlanetId}"`)
  }

  const distanceBeforeMovement = fleet.distanceToEnd
  const distanceMoved = advanceJourneyDistance(fleet, movement, context.turnState.turn, distanceBeforeMovement)
  const outcomes = [
    EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" moved ${distanceMoved} light years towards Planet "${destinationPlanet.name}"`,
    }),
  ]
  const advance = { fleet, movement, outcomes, wasContinuation }
  if (fleet.distanceToEnd === 0) {
    fleet.arrivedAtTick = typedParse(
      NonNegativeNumberSchema,
      distanceBeforeMovement === 0 ? 0 : Math.ceil((distanceMoved / movement.speed) * MOVEMENT_TICKS),
    )
  }
  return Result.Success(advance)
}
function advanceJourneyDistance(fleet: ResolutionFleet, movement: FleetMovement, turn: number, distanceBeforeMovement: number): number {
  const distanceMoved = Math.min(movement.speed, distanceBeforeMovement)
  const remainingAfterMovement = distanceBeforeMovement - distanceMoved
  const advancesSinceDeparture = turn - movement.departureTurn + 1
  const maximumEarlierDistance = distanceBeforeMovement + movement.speed * advancesSinceDeparture
  const roundingEnvelope = (Number.EPSILON / 2) * advancesSinceDeparture * maximumEarlierDistance
  const finiteRoundingEnvelope =
    Number.isFinite(maximumEarlierDistance) && Number.isFinite(roundingEnvelope) ? Math.min(roundingEnvelope, movement.speed / 2) : 0
  // Absorb only cumulative binary64 subtraction noise; persisted distance and captured speed remain authoritative.
  fleet.distanceToEnd = typedParse(
    NonNegativeNumberSchema,
    remainingAfterMovement > 0 && remainingAfterMovement <= finiteRoundingEnvelope ? 0 : remainingAfterMovement,
  )
  return distanceMoved
}

function settleArrival(context: TurnContext, arrival: JourneyAdvance): Result<EffectOutcome, ReturnType<typeof EffectError.Failed>> {
  const fleet = arrival.fleet
  const destinationPlanetId = fleet.destinationPlanetId
  if (destinationPlanetId === undefined) {
    return Result.Failure(EffectError.Failed({ error: `Arriving Fleet "${fleet.id}" has no destination Planet` }))
  }
  const destinationPlanet = context.turnState.planets[destinationPlanetId]
  if (destinationPlanet === undefined) {
    return Result.Failure(EffectError.Failed({ error: `Arriving Fleet "${fleet.id}" has an unknown destination Planet` }))
  }

  const stationaryFleets = Object.values(context.turnState.fleets)
    .filter(
      (candidate) =>
        candidate.id !== fleet.id &&
        candidate.ownerPlayerId === fleet.ownerPlayerId &&
        isFleetPresentAtPlanet(candidate, destinationPlanetId),
    )
    .toSorted((first, second) => compareOrdinalStrings(first.id, second.id))
  if (stationaryFleets.length > 1) {
    return Result.Failure(EffectError.Failed({ error: `Multiple stationary friendly Fleets exist at Planet "${destinationPlanetId}"` }))
  }

  const targetFleet = stationaryFleets[0]
  if (targetFleet === undefined) {
    fleet.originPlanetId = destinationPlanetId
    fleet.destinationPlanetId = undefined
    fleet.distanceToEnd = undefined
    fleet.movement = undefined
    return Result.Success(EffectOutcome.Resolved({ result: `Fleet "${fleet.name}" arrived on Planet "${destinationPlanet.name}"` }))
  }

  const merged = mergeArrivalStrength(context, fleet, targetFleet, destinationPlanetId)
  if (Result.isFailure(merged)) {
    return merged
  }
  const mergedStrength = merged.value
  return Result.Success(
    EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" arrived on Planet "${destinationPlanet.name}" and merged ${mergedStrength} Strength into Fleet "${targetFleet.name}"`,
    }),
  )
}
function mergeArrivalStrength(
  context: TurnContext,
  fleet: ResolutionFleet,
  targetFleet: ResolutionFleet,
  destinationPlanetId: PlanetId,
): Result<number, ReturnType<typeof EffectError.Failed>> {
  if (!isSafeStrength(fleet.strength) || !isSafeStrength(targetFleet.strength)) {
    return Result.Failure(EffectError.Failed({ error: `Fleet merge at Planet "${destinationPlanetId}" has an unsafe Strength value` }))
  }
  const mergedStrengthBigInt = BigInt(targetFleet.strength) + BigInt(fleet.strength)
  if (mergedStrengthBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Result.Failure(EffectError.Failed({ error: `Fleet merge at Planet "${destinationPlanetId}" exceeds the safe Strength range` }))
  }
  const mergedStrength = fleet.strength
  targetFleet.strength = typedParse(NonNegativeSafeIntegerSchema, Number(mergedStrengthBigInt))
  if (fleet.arrivedAtTick !== undefined) {
    targetFleet.arrivedAtTick = typedParse(
      NonNegativeNumberSchema,
      Math.min(targetFleet.arrivedAtTick ?? fleet.arrivedAtTick, fleet.arrivedAtTick),
    )
  }
  rebindMergedFleet(context, fleet, targetFleet)
  return Result.Success(mergedStrength)
}
function rebindMergedFleet(context: TurnContext, fleet: ResolutionFleet, targetFleet: ResolutionFleet): void {
  TurnState.removeFleet(context.turnState, fleet.id)
  context.removedFleetIds.add(fleet.id)
  context.fleetIdRebindings.set(fleet.id, targetFleet.id)
  rebindSurvivingFleet(context, fleet.id, targetFleet.id)
  rebindArrivalIntents(context, fleet.id, targetFleet.id)
}
function rebindSurvivingFleet(context: TurnContext, removed: FleetId, survivor: FleetId): void {
  for (const [id, bound] of context.fleetIdRebindings) {
    if (bound === removed) {
      context.fleetIdRebindings.set(id, survivor)
    }
  }
}
function rebindArrivalIntents(context: TurnContext, removed: FleetId, survivor: FleetId): void {
  for (const intent of [...context.pendingArrivalAssaults, ...context.pendingArrivalColonizations]) {
    if (intent.actualFleetId === removed) {
      intent.actualFleetId = survivor
    }
  }
}
function isSafeStrength(strength: number): boolean {
  return Number.isSafeInteger(strength) && strength >= 0
}

function queueArrivalEffects(context: TurnContext, arrival: JourneyAdvance): Result<void, ReturnType<typeof EffectError.Failed>> {
  for (const pending of arrival.movement.pendingArrivalEffects) {
    const targetPlanetId = resolveTargetId(arrival.movement.submission.selectedTargets, pending.effectDefinition.targets.planet)
    const common = {
      definitionOrdinal: pending.definitionOrdinal,
      submittedAction: arrival.movement.submission,
      departureTurn: arrival.movement.departureTurn,
      initiatingJourneyId: arrival.fleet.id,
      actualFleetId: resolveFleetRebinding(context.fleetIdRebindings, arrival.fleet.id),
      planetId: targetPlanetId,
      tick: arrival.fleet.arrivedAtTick ?? 0,
      actionOutcomes: arrival.outcomes,
    }
    if (pending.effectDefinition.type === "FLEET_ASSAULT") {
      const intent: PendingArrivalAssaultIntent = { ...common, effectDefinition: pending.effectDefinition }
      context.pendingArrivalAssaults.push(intent)
    } else {
      const intent: PendingArrivalColonizationIntent = { ...common, effectDefinition: pending.effectDefinition }
      context.pendingArrivalColonizations.push(intent)
    }
  }
  return Result.Success(undefined)
}

function recordAdvance(context: TurnContext, advance: JourneyAdvance, movement: FleetMovement): void {
  if (advance.wasContinuation) {
    context.resolvedContinuations.push({
      originatingSubmission: movement.submission,
      departureTurn: movement.departureTurn,
      actionOutcomes: advance.outcomes,
    })
    return
  }
  context.effectPool.appendOutcomes(movement.submission, advance.outcomes)
}

function compareEffects(first: Effect, second: Effect): number {
  const playerOrder = compareOrdinalStrings(first.submittedAction.playerId, second.submittedAction.playerId)
  if (playerOrder !== 0) {
    return playerOrder
  }
  const actionOrder = compareOrdinalStrings(first.submittedAction.id, second.submittedAction.id)
  if (actionOrder !== 0) {
    return actionOrder
  }
  return first.definitionOrdinal - second.definitionOrdinal
}

function movementFailure(error: string): Result<never, ResolvePhaseError> {
  return Result.Failure(ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error }) }))
}
