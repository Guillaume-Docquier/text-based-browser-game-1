import { Assert, Range, type Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"
import type { StarCoordinates } from "#shared/domain/world/stars/StarCoordinates.ts"
import { generateName } from "#shared/galaxy-creation/attributes/generateName.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/attributes/toPlanetCoordinates.ts"
import type { PlanetTopology } from "#shared/galaxy-creation/topology/planetTopologyGenerator.ts"

const PLANET_BIOMES = Object.values(PlanetBiome)
const PLANET_SIZES = Object.values(PlanetSize)
const BIOME_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_BIOMES.length - 1 })
const SIZE_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_SIZES.length - 1 })

export const PLANET_AREA_RANGES = {
  [PlanetSize.SMALL]: Range.integer({ min: 2, max: 4 }),
  [PlanetSize.MEDIUM]: Range.integer({ min: 4, max: 7 }),
  [PlanetSize.LARGE]: Range.integer({ min: 7, max: 11 }),
} as const satisfies Record<PlanetSize, ReturnType<typeof Range.integer>>

export function generatePlanetAttributes({
  planet,
  planetKey,
  body,
  starCoordinates,
  rng,
}: {
  planet: PlanetTopology
  planetKey: string
  body?: { name: string; size: PlanetSize; biome: PlanetBiome }
  starCoordinates: StarCoordinates
  rng: Rng
}): Planet {
  const biome = body?.biome ?? PLANET_BIOMES[rng.int(BIOME_INDEX_RANGE)]
  const size = body?.size ?? PLANET_SIZES[rng.int(SIZE_INDEX_RANGE)]
  Assert.isDefined(biome)
  Assert.isDefined(size)

  return {
    name: typedParse(PlanetNameSchema, body?.name ?? generateName("planet", rng)),
    biome,
    size,
    metalProduction: 0,
    remainingMetalDeposit: 0,
    area: rng.int(PLANET_AREA_RANGES[size]),
    x: planet.x,
    y: planet.y,
    id: typedParse(PlanetIdSchema, v5(`planet:${planetKey}`, v5.URL)),
    ownerPlayerId: null,
    coordinates: toPlanetCoordinates({ starCoordinates, orbitDistanceAU: planet.orbitDistanceAU }),
  }
}
