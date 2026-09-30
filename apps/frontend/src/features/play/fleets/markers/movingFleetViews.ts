import type { Fleet, LobbyPlayer, Planet, StarSystem } from "@api-types"
import { Assert, Scalar } from "@guillaume-docquier/tools-ts"

/**
 * Coordinates in a map's SVG space.
 */
export type MapPoint = { readonly x: number; readonly y: number }

/**
 * A moving Fleet projected into a map, with an optional inset expressed by markerPosition.
 */
export type MovingFleetView = {
  readonly fleet: Fleet
  readonly owner: LobbyPlayer
  readonly origin: Planet
  readonly destination: Planet
  readonly start: MapPoint
  readonly position: MapPoint
  readonly markerPosition: MapPoint
  readonly end: MapPoint
  readonly heading: number
  /**
   * Marks a Fleet projected at the edge of a Star System while physically outside it.
   */
  readonly isOutsideSystem?: boolean
}

type PlanetLocation = { readonly planet: Planet; readonly system: StarSystem }
type MovingFleetJourney = {
  readonly fleet: Fleet
  readonly owner: LobbyPlayer
  readonly origin: PlanetLocation
  readonly destination: PlanetLocation
  readonly traveledFraction: number
}

/**
 * Resolves moving Fleets and their journey progress before map-specific projection.
 */
export function getMovingFleetJourneys(
  systems: readonly StarSystem[],
  fleets: readonly Fleet[],
  players: readonly LobbyPlayer[],
): MovingFleetJourney[] {
  const planetsById = new Map(systems.flatMap((system) => system.planets.map((planet) => [planet.id, { planet, system }] as const)))
  const ownersById = new Map(players.map((player) => [player.id, player]))
  const journeys: MovingFleetJourney[] = []

  for (const fleet of fleets) {
    if (fleet.destinationPlanetId === undefined) {
      continue
    }

    Assert.isDefined(fleet.distanceToEnd)
    const origin = planetsById.get(fleet.originPlanetId)
    const destination = planetsById.get(fleet.destinationPlanetId)
    const owner = ownersById.get(fleet.ownerPlayerId)
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    Assert.isDefined(owner)

    const totalDistance = Math.hypot(destination.planet.x - origin.planet.x, destination.planet.y - origin.planet.y)
    const traveledFraction = totalDistance === 0 ? 0 : Scalar.clamp(1 - fleet.distanceToEnd / totalDistance, 0, 1)
    journeys.push({ fleet, owner, origin, destination, traveledFraction })
  }

  return journeys
}
