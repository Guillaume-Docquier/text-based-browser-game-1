import type { Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"
import { assignHomePlanets } from "#shared/galaxy-creation/assignHomePlanets.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { type GeneratedGalaxy, galaxyGenerator } from "#shared/galaxy-creation/generation/galaxy.generator.ts"
import { spiralGenerator } from "#shared/galaxy-creation/generation/points/spiral.generator.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/toPlanetCoordinates.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/toStarCoordinates.ts"

/**
 * Creates a galaxy that's ready to play in.
 */
export function createGalaxy({
  galaxyCreationSettings,
  playerIds,
  rng,
}: {
  galaxyCreationSettings: GalaxyCreationSettings
  playerIds: readonly PlayerId[]
  rng: Rng
}): Galaxy {
  const generatedGalaxy = generateGalaxy({ galaxyCreationSettings, rng })
  const galaxy = toGalaxyModel({ generatedGalaxy })
  const withHomePlanets = assignHomePlanets({ galaxyCreationSettings, galaxy, playerIds, rng })

  return withHomePlanets
}

/**
 * Generates a galaxy deterministically using default settings.
 */
function generateGalaxy({ galaxyCreationSettings, rng }: { galaxyCreationSettings: GalaxyCreationSettings; rng: Rng }): GeneratedGalaxy {
  return galaxyGenerator({
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

/**
 * Augments a generated galaxy with gameplay concepts, like ids, coordinates, etc
 */
function toGalaxyModel({ generatedGalaxy }: { generatedGalaxy: GeneratedGalaxy }): Galaxy {
  let nextPlanetId = 1
  return {
    systems: generatedGalaxy.systems.map((system, starIndex) => {
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
