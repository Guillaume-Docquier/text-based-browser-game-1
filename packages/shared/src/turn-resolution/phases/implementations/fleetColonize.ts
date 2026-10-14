import { Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import { getFleetColonizationEligibility } from "#shared/domain/world/fleets/fleetColonizationEligibility.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type FleetColonizeAttemptEvaluation = Readonly<{ eligible: true }> | Readonly<{ eligible: false; outcome: EffectOutcome }>

/**
 * Performs the shared, side-effect-free current-state check used by filtering and application.
 */
export function evaluateFleetColonizeAttempt({
  context,
  submittingPlayerId,
  fleetId,
  planetId,
  strengthRequirement,
}: {
  context: TurnContext
  submittingPlayerId: PlayerId
  fleetId: FleetId
  planetId: PlanetId
  strengthRequirement: PositiveInteger
}): Result<FleetColonizeAttemptEvaluation, EffectError> {
  const planet = TurnState.getPlanet(context.turnState, planetId)
  if (planet === undefined) {
    return Result.Failure(EffectError.Failed({ error: `Colonize target Planet "${planetId}" does not exist` }))
  }

  const fleet = TurnState.getFleet(context.turnState, fleetId)
  if (fleet === undefined) {
    return Result.Success({
      eligible: false,
      outcome: EffectOutcome.Prevented({ reason: `Fleet "${fleetId}" was destroyed before colonization` }),
    })
  }
  if (!Number.isSafeInteger(fleet.strength) || fleet.strength < 0) {
    return Result.Failure(EffectError.Failed({ error: `Fleet "${fleetId}" has an unsafe Strength value` }))
  }
  if (!isFleetPresentAtPlanet(fleet, planetId)) {
    return Result.Success({
      eligible: false,
      outcome: EffectOutcome.Prevented({ reason: `Fleet "${fleetId}" is not present at Planet "${planetId}"` }),
    })
  }

  const eligibility = getFleetColonizationEligibility({
    planetOwnerPlayerId: planet.ownerPlayerId,
    fleetOwnerPlayerId: fleet.ownerPlayerId,
    submittingPlayerId,
    fleetStrength: fleet.strength,
    strengthRequirement,
  })
  if (!eligibility.eligible) {
    return Result.Success({ eligible: false, outcome: EffectOutcome.Prevented({ reason: eligibility.reason.message }) })
  }

  return Result.Success({ eligible: true })
}

export function resolveFleetColonizeAttempt({
  context,
  submittingPlayerId,
  fleetId,
  planetId,
  strengthRequirement,
}: {
  context: TurnContext
  submittingPlayerId: PlayerId
  fleetId: FleetId
  planetId: PlanetId
  strengthRequirement: PositiveInteger
}): Result<EffectOutcome, EffectError> {
  const eligibility = evaluateFleetColonizeAttempt({ context, submittingPlayerId, fleetId, planetId, strengthRequirement })
  if (Result.isFailure(eligibility)) {
    return eligibility
  }
  if (!eligibility.value.eligible) {
    return Result.Success(eligibility.value.outcome)
  }

  const planet = TurnState.getPlanet(context.turnState, planetId)
  const fleet = TurnState.getFleet(context.turnState, fleetId)
  if (planet === undefined || fleet === undefined) {
    return Result.Failure(EffectError.Failed({ error: "Colonize state changed after its eligibility check" }))
  }

  planet.ownerPlayerId = submittingPlayerId
  context.changedPlanetIds.add(planet.id)
  fleet.strength = typedParse(NonNegativeSafeIntegerSchema, fleet.strength - strengthRequirement)
  if (fleet.strength === 0) {
    TurnState.removeFleet(context.turnState, fleet.id)
    context.removedFleetIds.add(fleet.id)
  }

  return Result.Success(
    EffectOutcome.Resolved({
      result: `Fleet "${fleet.name}" colonized Planet "${planet.name}" with ${strengthRequirement} Strength`,
    }),
  )
}
