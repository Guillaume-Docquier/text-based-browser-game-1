import type { Rng } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { assignHomePlanets } from "#shared/galaxy-creation/attributes/assignHomePlanets.ts"
import { populatePlanet } from "#shared/galaxy-creation/attributes/populatePlanet.ts"
import { populateStar } from "#shared/galaxy-creation/attributes/populateStar.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import type { GalaxyTopology } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"

export function generateGalaxyAttributes({
  galaxyTopology,
  galaxyCreationSettings,
  playerIds,
  rng,
}: {
  galaxyTopology: GalaxyTopology
  galaxyCreationSettings: GalaxyCreationSettings
  playerIds: readonly PlayerId[]
  rng: Rng
}): Galaxy {
  let nextPlanetNumber = 1
  const systems = galaxyTopology.systems.map((system, starIndex) => {
    const star = populateStar(system.star, starIndex + 1, rng)
    const planets = system.planets.map((planet) =>
      populatePlanet({ planet, planetNumber: nextPlanetNumber++, starCoordinates: star.coordinates, rng }),
    )
    return { star, planets }
  })

  return assignHomePlanets({ galaxy: { systems }, galaxyCreationSettings, playerIds, rng })
}
