import type { Rng } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { generateGalaxyAttributes } from "#shared/galaxy-creation/attributes/generateGalaxyAttributes.ts"
import type { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { type GalaxyTopology, galaxyTopologyGenerator } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"
import { spiralGenerator } from "#shared/galaxy-creation/topology/patterns/spiralGenerator.ts"

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
  return generateGalaxyAttributes({ galaxyTopology, galaxyCreationSettings, playerIds, rng })
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
