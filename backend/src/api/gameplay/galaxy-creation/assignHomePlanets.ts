import { Angle, Assert, Distance, type Rng, UnitOfAngle, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { GalaxyModel } from "../GalaxyModel.ts"

/**
 * Assigns home planets in an empty galaxy
 */
export function assignHomePlanets({
  galaxyCreationSettings,
  galaxy,
  playerIds,
  rng,
}: {
  galaxyCreationSettings: GalaxyCreationSettings
  galaxy: GalaxyModel
  playerIds: readonly PlayerId[]
  rng: Rng
}): GalaxyModel {
  const availablePlanetCount = galaxy.systems.flatMap(({ planets }) => planets).filter(({ ownerPlayerId }) => ownerPlayerId === null).length
  Assert.isTrue(availablePlanetCount >= playerIds.length)

  const homePlanetOwners = new Map<PlanetId, PlayerId>()
  const shuffledPlayerIds = rng.shuffle([...playerIds])

  // Distribute evenly in a circle
  const angleIncrement = Angle.create(360 / shuffledPlayerIds.length, UnitOfAngle.DEGREES)

  for (const [index, playerId] of shuffledPlayerIds.entries()) {
    const angle = rng.normal(
      index * Angle.in(angleIncrement, UnitOfAngle.RADIANS),
      Angle.in(galaxyCreationSettings.HOME_WORLD_ANGLE_STANDARD_DEVIATION, UnitOfAngle.RADIANS),
    )

    // Keep the distance positive to spread players outwards of the center, each in their direction
    // Negative numbers are rare here, and it wouldn't break anything, we just prefer a ring pattern
    const distance = Math.abs(
      rng.normal(
        Distance.in(galaxyCreationSettings.HOME_WORLD_DISTANCE, UnitOfDistance.LIGHT_YEARS),
        Distance.in(galaxyCreationSettings.HOME_WORLD_DISTANCE_STANDARD_DEVIATION, UnitOfDistance.LIGHT_YEARS),
      ),
    )

    const target = {
      x: GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.cos(angle),
      y: GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.sin(angle),
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

  // Not really efficient to copy the whole galaxy again
  // In reality that shouldn't matter that much, but if it becomes a problem we'll optimize it
  // The main thing is that all the models are intentionally readonly, so we can't mutate them
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
