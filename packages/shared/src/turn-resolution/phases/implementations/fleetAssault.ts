import { Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { compareOrdinalStrings } from "#shared/domain/compareOrdinalStrings.ts"
import { NonNegativeSafeIntegerSchema } from "#shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { EffectOutcome } from "#shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { isFleetPresentAtPlanet } from "#shared/domain/world/fleets/isFleetPresentAtPlanet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import type { TurnContext } from "#shared/turn-resolution/TurnContext.ts"
import { TurnState } from "#shared/turn-resolution/TurnState.ts"

type FleetAssaultAttempt = Readonly<{
  context: TurnContext
  submittingPlayerId: PlayerId
  attackingFleetId: FleetId
  planetId: PlanetId
}>

type DefenderAllocation = {
  fleetId: FleetId
  strength: number
  loss: number
  remainder: bigint
}

/**
 * Resolves one simultaneous whole-Strength exchange against all stationary enemy Fleets on a Planet.
 */
export function resolveFleetAssaultAttempt({
  context,
  submittingPlayerId,
  attackingFleetId,
  planetId,
}: FleetAssaultAttempt): Result<EffectOutcome, EffectError> {
  const planet = TurnState.getPlanet(context.turnState, planetId)
  if (planet === undefined) {
    return Result.Failure(EffectError.Failed({ error: `Assault target Planet "${planetId}" does not exist` }))
  }

  const attacker = TurnState.getFleet(context.turnState, attackingFleetId)
  if (attacker === undefined) {
    return Result.Success(EffectOutcome.Prevented({ reason: `Attacking Fleet "${attackingFleetId}" was destroyed before its Assault` }))
  }
  if (attacker.ownerPlayerId !== submittingPlayerId) {
    return Result.Failure(
      EffectError.Failed({ error: `Assaulting Player "${submittingPlayerId}" does not own Fleet "${attackingFleetId}"` }),
    )
  }
  if (!Number.isSafeInteger(attacker.strength) || attacker.strength < 0) {
    return Result.Failure(EffectError.Failed({ error: `Attacking Fleet "${attackingFleetId}" has an unsafe Strength value` }))
  }
  if (!isFleetPresentAtPlanet(attacker, planetId)) {
    return Result.Success(
      EffectOutcome.Prevented({ reason: `Attacking Fleet "${attackingFleetId}" is not present at Planet "${planetId}"` }),
    )
  }

  const stationaryFleets = Object.values(context.turnState.fleets).filter(
    (fleet) =>
      fleet.originPlanetId === planetId &&
      fleet.destinationPlanetId === undefined &&
      fleet.distanceToEnd === undefined &&
      fleet.movement === undefined,
  )
  for (const fleet of stationaryFleets) {
    if (!Number.isSafeInteger(fleet.strength) || fleet.strength < 0) {
      return Result.Failure(EffectError.Failed({ error: `Fleet "${fleet.id}" has an unsafe Strength value` }))
    }
  }

  const defenders = stationaryFleets
    .filter((fleet) => fleet.ownerPlayerId !== submittingPlayerId && isFleetPresentAtPlanet(fleet, planetId))
    .toSorted((first, second) => compareOrdinalStrings(first.id, second.id))
  if (defenders.length === 0) {
    return Result.Success(EffectOutcome.Resolved({ result: `Fleet "${attacker.name}" found no enemy Fleets at Planet "${planet.name}"` }))
  }

  const defenderTotalBigInt = defenders.reduce((total, fleet) => total + BigInt(fleet.strength), 0n)
  if (defenderTotalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Result.Failure(EffectError.Failed({ error: `Enemy Strength at Planet "${planetId}" exceeds the safe integer range` }))
  }
  const defenderTotal = Number(defenderTotalBigInt)
  const exchangedStrength = Math.min(attacker.strength, defenderTotal)
  const allocations: DefenderAllocation[] = defenders.map((fleet) => {
    const numerator = BigInt(exchangedStrength) * BigInt(fleet.strength)
    const quotient = numerator / defenderTotalBigInt
    return {
      fleetId: fleet.id,
      strength: fleet.strength,
      loss: Number(quotient),
      remainder: numerator % defenderTotalBigInt,
    }
  })
  const assignedLoss = allocations.reduce((total, allocation) => total + allocation.loss, 0)
  let remainingLoss = exchangedStrength - assignedLoss
  const remainderOrder = allocations.toSorted((first, second) => {
    if (first.remainder !== second.remainder) {
      return first.remainder > second.remainder ? -1 : 1
    }
    return compareOrdinalStrings(first.fleetId, second.fleetId)
  })
  for (const allocation of remainderOrder) {
    if (remainingLoss === 0) {
      break
    }
    allocation.loss += 1
    remainingLoss -= 1
  }
  if (remainingLoss !== 0) {
    return Result.Failure(EffectError.Failed({ error: `Could not distribute Assault losses at Planet "${planetId}" exactly` }))
  }

  attacker.strength = typedParse(NonNegativeSafeIntegerSchema, attacker.strength - exchangedStrength)
  if (attacker.strength === 0) {
    TurnState.removeFleet(context.turnState, attacker.id)
    context.removedFleetIds.add(attacker.id)
  }
  for (const allocation of allocations) {
    const defender = TurnState.getFleet(context.turnState, allocation.fleetId)
    if (defender === undefined) {
      return Result.Failure(EffectError.Failed({ error: `Defending Fleet "${allocation.fleetId}" disappeared during Assault` }))
    }
    defender.strength = typedParse(NonNegativeSafeIntegerSchema, allocation.strength - allocation.loss)
    if (defender.strength === 0) {
      TurnState.removeFleet(context.turnState, defender.id)
      context.removedFleetIds.add(defender.id)
    }
  }

  return Result.Success(
    EffectOutcome.Resolved({
      result: `Fleet "${attacker.name}" exchanged ${exchangedStrength} Strength with ${defenderTotal} enemy Strength at Planet "${planet.name}"`,
    }),
  )
}
