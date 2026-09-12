import { Assert, type Rng } from "@guillaume-docquier/tools-ts"
import { GalaxySettings } from "#api/shared/GalaxySettings.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { GalaxyModel } from "./gameplay.repository.ts"

const HOME_DISTANCE = 35
const DISTANCE_STANDARD_DEVIATION = 5
const ANGLE_STANDARD_DEVIATION = (5 * Math.PI) / 180

export function assignHomePlanets({
  galaxy,
  playerIds,
  rng,
}: {
  galaxy: GalaxyModel
  playerIds: readonly PlayerId[]
  rng: Rng
}): GalaxyModel {
  const availablePlanetCount = galaxy.systems.flatMap(({ planets }) => planets).filter(({ ownerPlayerId }) => ownerPlayerId === null).length
  Assert.isTrue(availablePlanetCount >= playerIds.length)

  const homePlanetOwners = new Map<PlanetId, PlayerId>()
  const shuffledPlayerIds = rng.shuffle([...playerIds])
  const angleInterval = (2 * Math.PI) / shuffledPlayerIds.length

  for (const [index, playerId] of shuffledPlayerIds.entries()) {
    const angle = rng.normal(index * angleInterval, ANGLE_STANDARD_DEVIATION)
    const distance = Math.abs(rng.normal(HOME_DISTANCE, DISTANCE_STANDARD_DEVIATION))
    const target = {
      x: GalaxySettings.GALAXY_ORIGIN.x + distance * Math.cos(angle),
      y: GalaxySettings.GALAXY_ORIGIN.y + distance * Math.sin(angle),
    }

    let closestSystem: GalaxyModel["systems"][number] | undefined
    let closestDistance = Number.POSITIVE_INFINITY
    for (const system of galaxy.systems) {
      if (!system.planets.some((planet) => planet.ownerPlayerId === null && !homePlanetOwners.has(planet.id))) {
        continue
      }

      const distanceToTarget = Math.hypot(system.star.x - target.x, system.star.y - target.y)
      if (distanceToTarget < closestDistance) {
        closestSystem = system
        closestDistance = distanceToTarget
      }
    }
    Assert.isDefined(closestSystem)

    const availablePlanets = closestSystem.planets.filter((planet) => planet.ownerPlayerId === null && !homePlanetOwners.has(planet.id))
    const homePlanet = rng.draw(availablePlanets, 1).drawn[0]
    Assert.isDefined(homePlanet)
    homePlanetOwners.set(homePlanet.id, playerId)
  }

  return {
    systems: galaxy.systems.map((system) => ({
      ...system,
      planets: system.planets.map((planet) => ({
        ...planet,
        ownerPlayerId: homePlanetOwners.get(planet.id) ?? planet.ownerPlayerId,
      })),
    })),
  }
}
