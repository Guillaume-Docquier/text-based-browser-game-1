import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetMovement } from "#shared/domain/world/fleets/Fleet.ts"
import type { Effect } from "#shared/turn-resolution/effects/Effect.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { ResolvePhaseError } from "#shared/turn-resolution/phases/ResolvePhaseError.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
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
    first.localeCompare(second),
  )
  const advances: JourneyAdvance[] = []
  const arrivals: JourneyAdvance[] = []

  for (const fleetId of journeyIds) {
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
    const distanceMoved = Math.min(movement.speed, distanceBeforeMovement)
    const remainingAfterMovement = distanceBeforeMovement - distanceMoved
    const advancesSinceDeparture = context.turnState.turn - movement.departureTurn + 1
    const maximumEarlierDistance = distanceBeforeMovement + movement.speed * advancesSinceDeparture
    const roundingEnvelope = (Number.EPSILON / 2) * advancesSinceDeparture * maximumEarlierDistance
    const finiteRoundingEnvelope =
      Number.isFinite(maximumEarlierDistance) && Number.isFinite(roundingEnvelope) ? Math.min(roundingEnvelope, movement.speed / 2) : 0
    // Absorb only cumulative binary64 subtraction noise; persisted distance and captured speed remain authoritative.
    fleet.distanceToEnd = typedParse(
      NonNegativeNumberSchema,
      remainingAfterMovement > 0 && remainingAfterMovement <= finiteRoundingEnvelope ? 0 : remainingAfterMovement,
    )
    const outcomes = [
      EffectOutcome.Resolved({
        result: `Fleet "${fleet.name}" moved ${distanceMoved} light years towards Planet "${destinationPlanet.name}"`,
      }),
    ]
    const advance = { fleet, movement, outcomes, wasContinuation: previousJourneys.has(fleetId) }
    advances.push(advance)

    if (fleet.distanceToEnd === 0) {
      fleet.arrivedAtTick = typedParse(
        NonNegativeNumberSchema,
        distanceBeforeMovement === 0 ? 0 : Math.ceil((distanceMoved / movement.speed) * MOVEMENT_TICKS),
      )
      arrivals.push(advance)
    }
  }

  arrivals.sort((first, second) => {
    const tickOrder = (first.fleet.arrivedAtTick ?? 0) - (second.fleet.arrivedAtTick ?? 0)
    if (tickOrder !== 0) {
      return tickOrder
    }
    return first.fleet.id.localeCompare(second.fleet.id)
  })
  for (const arrival of arrivals) {
    const settleResult = settleArrival(context, arrival)
    if (Result.isFailure(settleResult)) {
      return Result.Failure(ResolvePhaseError.FailedEffect({ error: settleResult.error }))
    }
    arrival.outcomes.push(settleResult.value)
  }

  for (const advance of advances) {
    recordAdvance(context, advance, advance.movement)
  }

  context.resolvedContinuations.sort((first, second) => {
    const submissionOrder = first.originatingSubmission.id.localeCompare(second.originatingSubmission.id)
    if (submissionOrder !== 0) {
      return submissionOrder
    }
    return first.departureTurn - second.departureTurn
  })
  return Result.Success(context)
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
        candidate.originPlanetId === destinationPlanetId &&
        candidate.movement === undefined &&
        candidate.destinationPlanetId === undefined &&
        candidate.distanceToEnd === undefined,
    )
    .toSorted((first, second) => first.id.localeCompare(second.id))
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

  const mergedStrength = fleet.strength
  targetFleet.strength += mergedStrength
  if (fleet.arrivedAtTick !== undefined) {
    targetFleet.arrivedAtTick = typedParse(
      NonNegativeNumberSchema,
      Math.min(targetFleet.arrivedAtTick ?? fleet.arrivedAtTick, fleet.arrivedAtTick),
    )
  }
  TurnState.removeFleet(context.turnState, fleet.id)
  context.removedFleetIds.add(fleet.id)
  return Result.Success(
    EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" arrived on Planet "${destinationPlanet.name}" and merged ${mergedStrength} Strength into Fleet "${targetFleet.name}"`,
    }),
  )
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
  const submissionOrder = first.submittedAction.id.localeCompare(second.submittedAction.id)
  if (submissionOrder !== 0) {
    return submissionOrder
  }
  return first.id - second.id
}

function movementFailure(error: string): Result<never, ResolvePhaseError> {
  return Result.Failure(ResolvePhaseError.FailedEffect({ error: EffectError.Failed({ error }) }))
}
