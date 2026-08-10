import { Assert, Range, type Rng, type XY } from "@guillaume-docquier/tools-ts"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"

export type Planet = {
  readonly x: number
  readonly y: number
  readonly name: string
  readonly biome: PlanetBiome
  readonly size: PlanetSize
  readonly fertility: number
  readonly metal: number
  readonly fuel: number
  readonly energy: number
  readonly maxPopulation: number
  readonly area: number
}

const ANGLE_RANGE = Range.float({ min: 0, max: 2 * Math.PI })
const PLANET_BIOMES = Object.values(PlanetBiome)
const PLANET_SIZES = Object.values(PlanetSize)
const BIOME_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_BIOMES.length - 1 })
const SIZE_INDEX_RANGE = Range.integer({ min: 0, max: PLANET_SIZES.length - 1 })

type AttributeRanges<TAttribute extends keyof Planet> = Readonly<Record<TAttribute, ReturnType<typeof Range.integer>>>

/** Attribute ranges configured for each Planet Biome. */
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

/** Attribute ranges configured for each Planet Size. */
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

export function planetGenerator(starPosition: XY, orbitDistance: number, rng: Rng): Planet {
  const angle = rng.float(ANGLE_RANGE)
  const biome = PLANET_BIOMES[rng.int(BIOME_INDEX_RANGE)]
  const size = PLANET_SIZES[rng.int(SIZE_INDEX_RANGE)]
  Assert.isDefined(biome)
  Assert.isDefined(size)

  const biomeRanges = BIOME_ATTRIBUTE_RANGES[biome]
  const sizeRanges = SIZE_ATTRIBUTE_RANGES[size]

  return {
    x: starPosition.x + orbitDistance * Math.cos(angle),
    y: starPosition.y + orbitDistance * Math.sin(angle),
    name: planetNameGenerator(rng),
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

// To be improved
const INT_RANGE = Range.integer({ min: 999, max: 999999 })
function planetNameGenerator(rng: Rng): string {
  return `planet ${rng.int(INT_RANGE)}`
}
