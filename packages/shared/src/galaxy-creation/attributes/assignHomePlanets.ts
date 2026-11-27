import { Angle, Assert, Distance, type Mutable, type Rng, UnitOfAngle, UnitOfDistance, type XY } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import type { StarSystem } from "#shared/domain/world/StarSystem.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"

export function assignHomePlanets({
  galaxyCreationSettings,
  galaxy,
  playerIds,
  rng,
}: {
  galaxyCreationSettings: GalaxyCreationSettings
  galaxy: Galaxy
  playerIds: readonly PlayerId[]
  rng: Rng
}): Galaxy {
  const availablePlanetCount = galaxy.systems.flatMap(({ planets }) => planets).filter(({ ownerPlayerId }) => ownerPlayerId === null).length
  Assert.isTrue(availablePlanetCount >= playerIds.length)

  const shuffledPlayerIds = rng.shuffle([...playerIds].sort())

  const angleIncrement = Angle.create(360 / shuffledPlayerIds.length, UnitOfAngle.DEGREES)

  for (const [index, playerId] of shuffledPlayerIds.entries()) {
    const angle = rng.normal(
      index * Angle.in(angleIncrement, UnitOfAngle.RADIANS),
      Angle.in(galaxyCreationSettings.HOME_WORLD_ANGLE_STANDARD_DEVIATION, UnitOfAngle.RADIANS),
    )

    const distance = Math.abs(
      rng.normal(
        Distance.in(galaxyCreationSettings.HOME_WORLD_DISTANCE, UnitOfDistance.LIGHT_YEARS),
        Distance.in(galaxyCreationSettings.HOME_WORLD_DISTANCE_STANDARD_DEVIATION, UnitOfDistance.LIGHT_YEARS),
      ),
    )

    const targetHomeworldPosition = {
      x: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.cos(angle),
      y: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2 + distance * Math.sin(angle),
    }

    const closestSystem = getClosestSystemWithUnclaimedPlanets(targetHomeworldPosition, galaxy)
    const availablePlanets = closestSystem.planets.filter((planet) => planet.ownerPlayerId === null)
    const homePlanet = rng.draw(availablePlanets, 1).drawn[0]
    Assert.isDefined(homePlanet)

    // INTENT: We're cheating by mutating the galaxy to avoid copying it all. We're in the galaxy creation process, we can do that
    const mutableHomePlanet: Mutable<typeof homePlanet, "ownerPlayerId"> = homePlanet
    mutableHomePlanet.ownerPlayerId = playerId
  }

  return galaxy
}

// INTENT: This is simple to write but is O(nbPlanets). We can optimize this if that's a problem. We call this just once per player, so it's not the end of the world.
function getClosestSystemWithUnclaimedPlanets(target: XY, galaxy: Galaxy): StarSystem {
  let closestSystem: StarSystem | undefined
  let closestDistance = Number.POSITIVE_INFINITY
  for (const system of galaxy.systems) {
    if (!system.planets.some((planet) => planet.ownerPlayerId === null)) {
      continue
    }

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
