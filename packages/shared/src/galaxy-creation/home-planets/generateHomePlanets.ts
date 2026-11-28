import { Angle, Assert, type Mutable, type Rng, UnitOfAngle, type XY } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { StarSystem } from "#shared/domain/world/StarSystem.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"

export function generateHomePlanets({
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
  const availableSystems = new Set(galaxy.systems.filter(({ planets }) => planets.some(canBeHomePlanet)))
  Assert.isTrue(availableSystems.size >= playerIds.length)

  const shuffledPlayerIds = rng.shuffle([...playerIds].sort())
  const center = galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2

  for (const [index, playerId] of shuffledPlayerIds.entries()) {
    const offset = rng.float(galaxyCreationSettings.HOME_WORLD_ANGLE_OFFSET_DEGREES)
    const bearing = (index * 360) / shuffledPlayerIds.length + offset
    const radians = Angle.in(Angle.create(bearing, UnitOfAngle.DEGREES), UnitOfAngle.RADIANS)
    const distance = rng.float(galaxyCreationSettings.HOME_WORLD_DISTANCE_LIGHT_YEARS)
    const target = { x: center + distance * Math.cos(radians), y: center + distance * Math.sin(radians) }

    const system = getClosestSystem(target, availableSystems)
    availableSystems.delete(system)
    const homePlanet = rng.draw(system.planets.filter(canBeHomePlanet), 1).drawn[0]
    Assert.isDefined(homePlanet)

    const mutableHomePlanet: Mutable<typeof homePlanet, "ownerPlayerId"> = homePlanet
    mutableHomePlanet.ownerPlayerId = playerId
  }

  return galaxy
}

function canBeHomePlanet(planet: Planet): boolean {
  return planet.ownerPlayerId === null && planet.area >= 3
}

function getClosestSystem(target: XY, systems: ReadonlySet<StarSystem>): StarSystem {
  let closestSystem: StarSystem | undefined
  let closestDistance = Number.POSITIVE_INFINITY

  for (const system of systems) {
    const distance = Math.hypot(system.star.x - target.x, system.star.y - target.y)
    if (distance < closestDistance) {
      closestSystem = system
      closestDistance = distance
    }
  }
  Assert.isDefined(closestSystem)
  return closestSystem
}
