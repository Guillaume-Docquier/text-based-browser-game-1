import { Angle, Assert, Distance, type Mutable, type Rng, UnitOfAngle, UnitOfDistance, type XY } from "@guillaume-docquier/tools-ts"
import { GalaxyCreationSettings } from "#api/gameplay/galaxy-creation/GalaxyCreationSettings.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { GalaxyModel, GalaxySystemModel } from "../GalaxyModel.ts"

/**
 * Assigns home planets in an empty galaxy.
 * Although we return a galaxy, we actually mutate it for performance.
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

    const targetHomeworldPosition = {
      x: GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.cos(angle),
      y: GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.sin(angle),
    }

    const closestSystem = getClosestSystemWithUnclaimedPlanets(targetHomeworldPosition, galaxy)
    const availablePlanets = closestSystem.planets.filter((planet) => planet.ownerPlayerId === null)
    const homePlanet = rng.draw(availablePlanets, 1).drawn[0]
    Assert.isDefined(homePlanet)

    // We're cheating by mutating the galaxy to avoid copying it all
    // We're in the galaxy creation process, we can do that
    const mutableHomePlanet: Mutable<typeof homePlanet, "ownerPlayerId"> = homePlanet
    mutableHomePlanet.ownerPlayerId = playerId
  }

  return galaxy
}

/**
 * This is O(nbPlanets)
 * We can optimize this if that's a problem. Here, we call this just a handful of times (once per player), so it's not the end of the world.
 */
function getClosestSystemWithUnclaimedPlanets(target: XY, galaxy: GalaxyModel): GalaxySystemModel {
  let closestSystem: GalaxySystemModel | undefined
  let closestDistance = Number.POSITIVE_INFINITY
  for (const system of galaxy.systems) {
    if (!system.planets.some((planet) => planet.ownerPlayerId === null)) {
      continue
    }

    // Not using hypot to avoid the sqrt
    const distanceToTarget = sumOfSquares(system.star.x - target.x, system.star.y - target.y)
    if (distanceToTarget < closestDistance) {
      closestSystem = system
      closestDistance = distanceToTarget
    }
  }
  Assert.isDefined(closestSystem)

  return closestSystem
}

function sumOfSquares(x: number, y: number): number {
  return x * x + y * y
}
