import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

/**
 * Returns true only for a living stationary Fleet physically present on the requested Planet.
 */
export function isFleetPresentAtPlanet(fleet: Fleet, planetId: PlanetId): boolean {
  return (
    fleet.strength > 0 &&
    fleet.originPlanetId === planetId &&
    fleet.destinationPlanetId === undefined &&
    fleet.distanceToEnd === undefined &&
    fleet.movement === undefined
  )
}
