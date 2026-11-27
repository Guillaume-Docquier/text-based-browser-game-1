import { Assert, Range, type Rng } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v5 } from "uuid"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "#shared/domain/world/planets/PlanetName.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"
import { StarIdSchema } from "#shared/domain/world/stars/StarId.ts"
import { toPlanetCoordinates } from "#shared/galaxy-creation/toPlanetCoordinates.ts"
import type { GalaxyTopology } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"
import { toStarCoordinates } from "#shared/galaxy-creation/toStarCoordinates.ts"

const NAME_SUFFIX_RANGE = Range.integer({ min: 999, max: 999999 })
const PLANET_BIOMES = Object.values(PlanetBiome)
const PLANET_SIZES = Object.values(PlanetSize)
const BIOME_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_BIOMES.length - 1 })
const SIZE_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_SIZES.length - 1 })

type AttributeRanges<TAttribute extends keyof Planet> = Readonly<Record<TAttribute, ReturnType<typeof Range.integer>>>

export const BIOME_ATTRIBUTE_RANGES = {
  [PlanetBiome.OCEANIC]: {
    fertility: Range.integer({ min: 2, max: 4 }),
    metal: Range.integer({ min: 1, max: 2 }),
    fuel: Range.integer({ min: 1, max: 3 }),
    energy: Range.integer({ min: 1, max: 2 }),
  },
  [PlanetBiome.METALLIC]: {
    fertility: Range.integer({ min: 1, max: 2 }),
    metal: Range.integer({ min: 2, max: 4 }),
    fuel: Range.integer({ min: 1, max: 2 }),
    energy: Range.integer({ min: 1, max: 3 }),
  },
  [PlanetBiome.FROZEN]: {
    fertility: Range.integer({ min: 1, max: 2 }),
    metal: Range.integer({ min: 1, max: 3 }),
    fuel: Range.integer({ min: 2, max: 4 }),
    energy: Range.integer({ min: 1, max: 2 }),
  },
  [PlanetBiome.VOLCANIC]: {
    fertility: Range.integer({ min: 2, max: 3 }),
    metal: Range.integer({ min: 1, max: 2 }),
    fuel: Range.integer({ min: 1, max: 2 }),
    energy: Range.integer({ min: 2, max: 4 }),
  },
} as const satisfies Record<PlanetBiome, AttributeRanges<"fertility" | "metal" | "fuel" | "energy">>

export const SIZE_ATTRIBUTE_RANGES = {
  [PlanetSize.SMALL]: {
    maxPopulation: Range.integer({ min: 5, max: 10 }),
    area: Range.integer({ min: 2, max: 4 }),
  },
  [PlanetSize.MEDIUM]: {
    maxPopulation: Range.integer({ min: 10, max: 20 }),
    area: Range.integer({ min: 4, max: 7 }),
  },
  [PlanetSize.LARGE]: {
    maxPopulation: Range.integer({ min: 20, max: 35 }),
    area: Range.integer({ min: 7, max: 11 }),
  },
} as const satisfies Record<PlanetSize, AttributeRanges<"maxPopulation" | "area">>

export function toGalaxy({ galaxyTopology, rng }: { galaxyTopology: GalaxyTopology; rng: Rng }): Galaxy {
  let nextPlanetId = 1
  return {
    systems: galaxyTopology.systems.map((system, starIndex) => {
      const starCoordinates = toStarCoordinates(system.star)

      return {
        star: {
          ...system.star,
          id: typedParse(StarIdSchema, v5(`star:${starIndex + 1}`, v5.URL)),
          name: `star ${rng.int(NAME_SUFFIX_RANGE)}`,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          ...generatePlanetAttributes(rng),
          x: planet.x,
          y: planet.y,
          id: typedParse(PlanetIdSchema, v5(`planet:${nextPlanetId++}`, v5.URL)),
          ownerPlayerId: null,
          coordinates: toPlanetCoordinates({ starCoordinates, orbitDistanceAU: planet.orbitDistanceAU }),
        })),
      }
    }),
  }
}

function generatePlanetAttributes(
  rng: Rng,
): Pick<Planet, "name" | "biome" | "size" | "fertility" | "metal" | "fuel" | "energy" | "maxPopulation" | "area"> {
  const biome = PLANET_BIOMES[rng.int(BIOME_INDEX_RANGE)]
  const size = PLANET_SIZES[rng.int(SIZE_INDEX_RANGE)]
  Assert.isDefined(biome)
  Assert.isDefined(size)

  const biomeRanges = BIOME_ATTRIBUTE_RANGES[biome]
  const sizeRanges = SIZE_ATTRIBUTE_RANGES[size]

  return {
    name: typedParse(PlanetNameSchema, `planet ${rng.int(NAME_SUFFIX_RANGE)}`),
    biome,
    size,
    fertility: rng.int(biomeRanges.fertility),
    metal: rng.int(biomeRanges.metal),
    fuel: rng.int(biomeRanges.fuel),
    energy: rng.int(biomeRanges.energy),
    maxPopulation: rng.int(sizeRanges.maxPopulation),
    area: rng.int(sizeRanges.area),
  }
}
