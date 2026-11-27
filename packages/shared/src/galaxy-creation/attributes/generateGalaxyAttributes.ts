import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { populatePlanet } from "#shared/galaxy-creation/attributes/populatePlanet.ts"
import { populateStar } from "#shared/galaxy-creation/attributes/populateStar.ts"
import type { GalaxyTopology } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"

export function generateGalaxyAttributes({ galaxyTopology, rng }: { galaxyTopology: GalaxyTopology; rng: Rng }): Galaxy {
  let nextPlanetNumber = 1
  const systems = galaxyTopology.systems.map((system, starIndex) => {
    const star = populateStar(system.star, starIndex + 1, rng)
    const planets = system.planets.map((planet) =>
      populatePlanet({ planet, planetNumber: nextPlanetNumber++, starCoordinates: star.coordinates, rng }),
    )
    return { star, planets }
  })

  return { systems }
}
