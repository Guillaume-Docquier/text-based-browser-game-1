import type { Fleet, LobbyPlayer, Planet, StarSystem } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { ReactElement } from "react"
import { FleetIcon } from "@/features/play/galaxy/FleetIcon.tsx"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

// Fits the centered 32 × 34 icon at any heading, with a little space before the rim.
const FLEET_BOUNDARY_INSET = 12

type Point = { readonly x: number; readonly y: number }
export type MovingFleetView = {
  readonly fleet: Fleet
  readonly owner: LobbyPlayer
  readonly origin: Planet
  readonly destination: Planet
  readonly start: Point
  readonly position: Point
  readonly markerPosition: Point
  readonly end: Point
  readonly heading: number
}

/** Places a Fleet along its local route, keeping its icon just inside the boundary. */
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
  planets: ReadonlyArray<Point & Pick<Planet, "id">>
  fleets: readonly Fleet[]
  players: readonly LobbyPlayer[]
  boundaryRadius: number
  boundaryDistance: number
  center: number
}): MovingFleetView[] {
  const planetLocations = new Map(
    systems.flatMap((candidate) => candidate.planets.map((planet) => [planet.id, { planet, system: candidate }] as const)),
  )
  const displayedPlanets = new Map(planets.map((planet) => [planet.id, planet]))
  const owners = new Map(players.map((player) => [player.id, player]))
  const movingFleets: MovingFleetView[] = []

  for (const fleet of fleets) {
    if (fleet.destinationPlanetId === undefined) {
      continue
    }

    Assert.isDefined(fleet.distanceToEnd)
    const origin = planetLocations.get(fleet.originPlanetId)
    const destination = planetLocations.get(fleet.destinationPlanetId)
    const owner = owners.get(fleet.ownerPlayerId)
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    Assert.isDefined(owner)

    const originIsLocal = origin.system.star.id === system.star.id
    const destinationIsLocal = destination.system.star.id === system.star.id
    if (!originIsLocal && !destinationIsLocal) {
      continue
    }

    const totalDistance = distance(origin.planet, destination.planet)
    const traveledFraction = totalDistance === 0 ? 0 : clamp(1 - fleet.distanceToEnd / totalDistance)
    const worldPosition = interpolate(origin.planet, destination.planet, traveledFraction)

    let start: Point
    let end: Point
    let position: Point
    let markerPosition: Point

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
      const localProgress = insideSystem ? clamp(distance(worldPosition, localPlanet) / distance(worldBoundary, localPlanet)) : 1
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
      end,
      heading: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI + 90,
    })
  }

  return movingFleets
}

export function MovingFleetRoutes({ fleets }: { fleets: readonly MovingFleetView[] }): ReactElement {
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {fleets.map(({ fleet, owner, start, position, end }) => {
        const color = PLAYER_COLOR_HEX[owner.color]
        return (
          <g key={fleet.id} data-fleet-route={fleet.id}>
            <line
              x1={start.x}
              y1={start.y}
              x2={position.x}
              y2={position.y}
              stroke={color}
              strokeOpacity="0.85"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={position.x}
              y1={position.y}
              x2={end.x}
              y2={end.y}
              stroke={color}
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </g>
  )
}

export function MovingFleetMarkers({ fleets }: { fleets: readonly MovingFleetView[] }): ReactElement {
  return (
    <g className="pointer-events-none">
      {fleets.map(({ fleet, owner, origin, destination, markerPosition, heading }) => {
        const strengthLabel = fleet.strength.toLocaleString()
        return (
          <g
            key={fleet.id}
            role="img"
            aria-label={`${fleet.name}, ${owner.alias ?? `Player ${owner.id}`}, ${strengthLabel} strength, traveling from ${origin.name} to ${destination.name}`}
            data-fleet-marker={fleet.id}
            transform={`translate(${markerPosition.x} ${markerPosition.y})`}
          >
            <g transform={`rotate(${heading}) translate(0 -12)`}>
              <FleetIcon color={PLAYER_COLOR_HEX[owner.color]} />
            </g>
            <text
              y="40"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="12"
              paintOrder="stroke"
              stroke="#05080f"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {strengthLabel}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Intersects the route leaving a local Planet with a circle around the star. */
function routeBoundary(local: Point, remote: Point, star: Point, radius: number): Point {
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

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function interpolate(start: Point, end: Point, fraction: number): Point {
  return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
