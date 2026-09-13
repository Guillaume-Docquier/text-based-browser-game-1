import { branded, type Rng } from "@guillaume-docquier/tools-ts"
import { assignHomePlanets } from "#api/gameplay/galaxy-creation/assignHomePlanets.ts"
import { GalaxySettings } from "#api/gameplay/galaxy-creation/GalaxySettings.ts"
import { toPlanetCoordinates } from "#api/gameplay/galaxy-creation/PlanetCoordinates.ts"
import { toStarCoordinates } from "#api/gameplay/galaxy-creation/StarCoordinates.ts"
import type { GalaxyModel } from "#api/gameplay/GalaxyModel.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { type Galaxy, galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"

/**
 * Creates a galaxy that's ready to play in.
 */
export function createGalaxy({ rng, playerIds }: { rng: Rng; playerIds: readonly PlayerId[] }): GalaxyModel {
  const generatedGalaxy = generateGalaxy({ rng })
  const galaxy = toGalaxyModel({ generatedGalaxy })
  const withHomePlanets = assignHomePlanets({ galaxy, playerIds, rng })

  return withHomePlanets
}

/**
 * Generates a galaxy deterministically using default settings.
 */
function generateGalaxy({ rng }: { rng: Rng }): Galaxy {
  return galaxyGenerator({
    size: GalaxySettings.GALAXY_SIZE_LIGHT_YEARS,
    pointsGenerator: () =>
      spiralGenerator({
        origin: GalaxySettings.GALAXY_ORIGIN,
        radius: GalaxySettings.GALAXY_RADIUS_LIGHT_YEARS,
        nbPoints: GalaxySettings.GALAXY_SYSTEMS_COUNT,
        rng,
      }),
    rng,
  })
}

/**
 * Augments a generated galaxy with gameplay concepts, like ids, coordinates, etc
 */
function toGalaxyModel({ generatedGalaxy }: { generatedGalaxy: Galaxy }): GalaxyModel {
  let nextPlanetId = 1
  return {
    systems: generatedGalaxy.systems.map((system, starIndex) => {
      const starCoordinates = toStarCoordinates(system.star)

      return {
        star: {
          id: branded(starIndex + 1),
          ...system.star,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          id: branded(nextPlanetId++),
          ownerPlayerId: null,
          ...planet,
          coordinates: toPlanetCoordinates({ starCoordinates, star: system.star, planet }),
        })),
      }
    }),
  }
}
