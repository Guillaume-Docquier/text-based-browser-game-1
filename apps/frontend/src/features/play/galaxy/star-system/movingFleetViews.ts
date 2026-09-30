import type { Fleet, LobbyPlayer, Planet, StarSystem } from "@api-types"
import { Assert, Scalar } from "@guillaume-docquier/tools-ts"
import { getMovingFleetJourneys, type MapPoint, type MovingFleetView } from "@/features/play/fleets/markers/movingFleetViews.ts"

// Fits the centered 32 × 34 icon at any heading, with a little space before the rim.
const FLEET_BOUNDARY_INSET = 12

/**
 * Places a Fleet along its local route, keeping its icon just inside the boundary.
 */
export function getMovingFleetViews({
  system,
  systems,
  planets,
  fleets,
  players,
  boundaryRadius,
  boundaryDistance,
  center,
}: {
  system: StarSystem
  systems: readonly StarSystem[]
  planets: ReadonlyArray<MapPoint & Pick<Planet, "id">>
  fleets: readonly Fleet[]
  players: readonly LobbyPlayer[]
  boundaryRadius: number
  boundaryDistance: number
  center: number
}): MovingFleetView[] {
  const displayedPlanets = new Map(planets.map((planet) => [planet.id, planet]))
  const movingFleets: MovingFleetView[] = []

  for (const { fleet, owner, origin, destination, traveledFraction } of getMovingFleetJourneys(systems, fleets, players)) {
    const originIsLocal = origin.system.star.id === system.star.id
    const destinationIsLocal = destination.system.star.id === system.star.id
    if (!originIsLocal && !destinationIsLocal) {
      continue
    }

    const worldPosition = interpolate(origin.planet, destination.planet, traveledFraction)

    let start: MapPoint
    let end: MapPoint
    let position: MapPoint
    let markerPosition: MapPoint
    let isOutsideSystem = false

    if (originIsLocal && destinationIsLocal) {
      const displayedOrigin = displayedPlanets.get(origin.planet.id)
      const displayedDestination = displayedPlanets.get(destination.planet.id)
      Assert.isDefined(displayedOrigin)
      Assert.isDefined(displayedDestination)
      start = displayedOrigin
      end = displayedDestination
      position = interpolate(start, end, traveledFraction)
      markerPosition = position
    } else {
      const localPlanet = originIsLocal ? origin.planet : destination.planet
      const remotePlanet = originIsLocal ? destination.planet : origin.planet
      const displayedLocalPlanet = displayedPlanets.get(localPlanet.id)
      Assert.isDefined(displayedLocalPlanet)

      const worldBoundary = routeBoundary(localPlanet, remotePlanet, system.star, boundaryDistance)
      const boundaryAngle = Math.atan2(worldBoundary.y - system.star.y, worldBoundary.x - system.star.x)
      const displayedBoundary = {
        x: center + Math.cos(boundaryAngle) * boundaryRadius,
        y: center + Math.sin(boundaryAngle) * boundaryRadius,
      }
      const insideSystem = distance(worldPosition, system.star) <= boundaryDistance
      isOutsideSystem = !insideSystem
      const localProgress = insideSystem
        ? Scalar.clamp(distance(worldPosition, localPlanet) / distance(worldBoundary, localPlanet), 0, 1)
        : 1
      position = interpolate(displayedLocalPlanet, displayedBoundary, localProgress)
      // Inset along the route so the icon still lines up with its Planet and boundary crossing.
      const markerBoundary = routeBoundary(
        displayedLocalPlanet,
        displayedBoundary,
        { x: center, y: center },
        boundaryRadius - FLEET_BOUNDARY_INSET,
      )
      const markerProgressLimit = distance(displayedLocalPlanet, markerBoundary) / distance(displayedLocalPlanet, displayedBoundary)
      markerPosition = interpolate(displayedLocalPlanet, displayedBoundary, Math.min(localProgress, markerProgressLimit))
      start = originIsLocal ? displayedLocalPlanet : displayedBoundary
      end = originIsLocal ? displayedBoundary : displayedLocalPlanet
    }

    movingFleets.push({
      fleet,
      owner,
      origin: origin.planet,
      destination: destination.planet,
      start,
      position,
      markerPosition,
      isOutsideSystem,
      end,
      heading: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI + 90,
    })
  }

  return movingFleets
}

/**
 * Intersects the route leaving a local Planet with a circle around the star.
 */
function routeBoundary(local: MapPoint, remote: MapPoint, star: MapPoint, radius: number): MapPoint {
  const dx = remote.x - local.x
  const dy = remote.y - local.y
  const offsetX = local.x - star.x
  const offsetY = local.y - star.y
  const a = dx * dx + dy * dy
  const b = 2 * (offsetX * dx + offsetY * dy)
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius
  const discriminant = b * b - 4 * a * c
  Assert.isTrue(a > 0 && discriminant >= 0)
  const fraction = (-b + Math.sqrt(discriminant)) / (2 * a)
  return { x: local.x + dx * fraction, y: local.y + dy * fraction }
}

function distance(first: MapPoint, second: MapPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function interpolate(start: MapPoint, end: MapPoint, fraction: number): MapPoint {
  return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction }
}
