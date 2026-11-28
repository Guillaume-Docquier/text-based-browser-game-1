import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { Ship } from "#shared/domain/world/ships/Ship.ts"
import { tripPosition } from "#shared/domain/world/ships/travel.ts"
import { SUN_ID } from "#shared/domain/world/Sol.ts"
import type { Star } from "#shared/domain/world/stars/Star.ts"

export type PlanetFacts = Pick<Planet, "ownerPlayerId" | "biome" | "size" | "area" | "metalProduction" | "remainingMetalDeposit">
type Point = Readonly<{ x: number; y: number }>
type LocatedShip = Pick<Ship, "id" | "ownerPlayerId" | "planetId" | "starId" | "trip"> & { position: Point }
type Source = Point & { radius: number }
export const PLANET_SCAN_RADIUS = 3
export const SHIP_SCAN_RADIUS = 1.5

export function locateShips<S extends Pick<Ship, "id" | "ownerPlayerId" | "planetId" | "starId" | "trip">>(
  ships: readonly S[],
  planets: ReadonlyArray<Pick<Planet, "id" | "x" | "y">>,
  stars: ReadonlyArray<Pick<Star, "id" | "x" | "y">>,
): Array<S & { position: Point }> {
  const planetPositions = new Map(planets.map((p) => [p.id, p]))
  const starPositions = new Map(stars.map((s) => [s.id, s]))
  return ships.map((ship) => {
    const position =
      ship.trip !== null
        ? tripPosition(ship.trip)
        : ship.starId !== null
          ? starPositions.get(ship.starId)
          : ship.planetId !== null
            ? planetPositions.get(ship.planetId)
            : undefined
    if (position === undefined) {
      throw new Error("Ship station is missing")
    }
    return { ...ship, position: { x: position.x, y: position.y } }
  })
}
export function scanSources(
  playerId: PlayerId,
  planets: ReadonlyArray<Pick<Planet, "ownerPlayerId" | "x" | "y">>,
  ships: readonly LocatedShip[],
): Source[] {
  return [
    ...planets.filter((p) => p.ownerPlayerId === playerId).map((p) => ({ x: p.x, y: p.y, radius: PLANET_SCAN_RADIUS })),
    ...ships.filter((s) => s.ownerPlayerId === playerId).map((s) => ({ ...s.position, radius: SHIP_SCAN_RADIUS })),
  ]
}
export function inCurrentVision(point: Point, sources: readonly Source[]): boolean {
  return sources.some((source) => Math.hypot(source.x - point.x, source.y - point.y) <= source.radius)
}
export function canSeeShip(ship: LocatedShip, sources: readonly Source[]): boolean {
  return ship.starId === SUN_ID || inCurrentVision(ship.position, sources)
}
