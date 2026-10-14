import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { PositiveInteger } from "#shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import { isPlanetUnclaimed } from "#shared/domain/world/planets/isPlanetUnclaimed.ts"

export type FleetColonizationFailure = Readonly<{
  code: "PLANET_ALREADY_CLAIMED" | "FLEET_MISSING" | "FLEET_NOT_OWNED" | "INVALID_STRENGTH" | "INSUFFICIENT_STRENGTH"
  message: string
}>

export type FleetColonizationEligibility = Readonly<{ eligible: true }> | Readonly<{ eligible: false; reason: FleetColonizationFailure }>

/**
 * Applies the current-state ownership and Strength requirements shared by selection and resolution.
 */
export function getFleetColonizationEligibility({
  planetOwnerPlayerId,
  fleetOwnerPlayerId,
  submittingPlayerId,
  fleetStrength,
  strengthRequirement,
}: {
  planetOwnerPlayerId: PlayerId | null
  fleetOwnerPlayerId: PlayerId | undefined
  submittingPlayerId: PlayerId
  fleetStrength: number | undefined
  strengthRequirement: PositiveInteger
}): FleetColonizationEligibility {
  if (!isPlanetUnclaimed(planetOwnerPlayerId)) {
    return { eligible: false, reason: { code: "PLANET_ALREADY_CLAIMED", message: "Planet is already claimed" } }
  }
  if (fleetOwnerPlayerId === undefined) {
    return { eligible: false, reason: { code: "FLEET_MISSING", message: "Fleet was destroyed before colonization" } }
  }
  if (fleetOwnerPlayerId !== submittingPlayerId) {
    return {
      eligible: false,
      reason: { code: "FLEET_NOT_OWNED", message: "Fleet is no longer owned by the submitting player" },
    }
  }
  if (fleetStrength === undefined) {
    return { eligible: false, reason: { code: "FLEET_MISSING", message: "Fleet is missing before colonization" } }
  }
  if (!Number.isSafeInteger(fleetStrength) || fleetStrength < 0) {
    return { eligible: false, reason: { code: "INVALID_STRENGTH", message: "Fleet has an unsafe Strength value" } }
  }
  if (fleetStrength < strengthRequirement) {
    return {
      eligible: false,
      reason: {
        code: "INSUFFICIENT_STRENGTH",
        message: `Fleet has ${fleetStrength} Strength, below the ${strengthRequirement} required to colonize`,
      },
    }
  }
  return { eligible: true }
}
