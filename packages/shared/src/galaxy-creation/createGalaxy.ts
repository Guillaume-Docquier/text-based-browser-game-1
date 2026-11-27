import type { Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"
import { assignHomePlanets } from "#shared/galaxy-creation/assignHomePlanets.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/toPlanetCoordinates.ts"
import { type GalaxyTopology, galaxyTopologyGenerator } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"
import { spiralGenerator } from "#shared/galaxy-creation/topology/patterns/spiralGenerator.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/toStarCoordinates.ts"

export function createGalaxy({
  galaxyCreationSettings,
  playerIds,
  rng,
}: {
  galaxyCreationSettings: GalaxyCreationSettings
  playerIds: readonly PlayerId[]
  rng: Rng
}): Galaxy {
  const galaxyTopology = generateGalaxyTopology({ galaxyCreationSettings, rng })
  const galaxy = toGalaxy({ galaxyTopology })
  const withHomePlanets = assignHomePlanets({ galaxyCreationSettings, galaxy, playerIds, rng })

  return withHomePlanets
}

function generateGalaxyTopology({
  galaxyCreationSettings,
  rng,
}: {
  galaxyCreationSettings: GalaxyCreationSettings
  rng: Rng
}): GalaxyTopology {
  return galaxyTopologyGenerator({
    size: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS,
    pointsGenerator: () =>
      spiralGenerator({
        origin: {
          x: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2,
          y: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2,
        },
        radius: galaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2,
        nbPoints: galaxyCreationSettings.GALAXY_SYSTEMS_COUNT,
        rng,
      }),
    rng,
  })
}

function toGalaxy({ galaxyTopology }: { galaxyTopology: GalaxyTopology }): Galaxy {
  let nextPlanetId = 1
  return {
    systems: galaxyTopology.systems.map((system, starIndex) => {
      const starCoordinates = toStarCoordinates(system.star)

      return {
        star: {
          id: typedParse(StarIdSchema, v5(`star:${starIndex + 1}`, v5.URL)),
          ...system.star,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          id: typedParse(PlanetIdSchema, v5(`planet:${nextPlanetId++}`, v5.URL)),
          ownerPlayerId: null,
          ...planet,
          coordinates: toPlanetCoordinates({ starCoordinates, star: system.star, planet }),
        })),
      }
    }),
  }
}
