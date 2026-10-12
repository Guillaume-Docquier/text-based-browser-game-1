import { Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema, PositiveNumberSchema, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { defineMechanic } from "../definitions/defineMechanic.ts"

/**
 * Mirrors current per-submission movement, including landing and friendly merging.
 */
export const moveFleet = defineMechanic({
  targets: { fleet: "fleet", destination: "planet" },
  parameters: z.strictObject({ speed: PositiveNumberSchema }),
  phase: "fleetMovement",
  // Stationed-only and range restrictions are not current Test Ruleset requirements.
  requirements: (refs) => [{ kind: "ownedByActor", target: refs.fleet }],
  resolve: ({ fleet, destination }, { speed }, { state, actor }) => {
    const origin = state.planets[fleet.originPlanetId]
    if (origin === undefined) return Result.Failure([{ path: ["fleet", "originPlanetId"], message: "Unknown origin planet" }])
    fleet.destinationPlanetId ??= destination.id
    fleet.distanceToEnd ??= typedParse(NonNegativeNumberSchema, Math.hypot(destination.x - origin.x, destination.y - origin.y))
    const distance = Math.min(speed, fleet.distanceToEnd)
    fleet.distanceToEnd = typedParse(NonNegativeNumberSchema, fleet.distanceToEnd - distance)
    const outcomes = [{ status: "resolved" as const, message: `Moved fleet by ${distance}` }]
    if (fleet.distanceToEnd > 0) return Result.Success(outcomes)
    const existing = Object.values(state.fleets).find(
      (candidate) =>
        candidate.id !== fleet.id &&
        candidate.ownerPlayerId === actor.id &&
        candidate.originPlanetId === destination.id &&
        candidate.destinationPlanetId === undefined,
    )
    if (existing === undefined) {
      fleet.originPlanetId = destination.id
      fleet.destinationPlanetId = undefined
      fleet.distanceToEnd = undefined
      outcomes.push({ status: "resolved", message: "Fleet landed" })
    } else {
      existing.strength += fleet.strength
      fleet.strength = 0
      outcomes.push({ status: "resolved", message: "Fleet merged" })
    }
    return Result.Success(outcomes)
  },
})
