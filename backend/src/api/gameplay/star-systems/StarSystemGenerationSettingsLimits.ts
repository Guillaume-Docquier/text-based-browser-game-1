import { Range } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"
import { MAX_UINT_32 } from "#lib/randomUInt32.ts"

export const FIRST_ORBIT_SECTOR_COUNT = 2

/**
 * Restricting the orbits guards against very large star systems (in terms of data & generation).
 * But also guides players to define maps that make sense. Beyond 6 orbits, the game is just too big.
 */
export const MAX_ORBIT_COUNT = 5

/**
 * Guides players to define maps that make sense. Beyond 5 bodies per sector, the sectors and the UI will be too crowded.
 */
const MAX_BODY_COUNT_PER_SECTOR = 4

/**
 * Given X orbits, the total sector count S is `S = 2^1 + 2^2 + 2^3 + ... + 2^X`
 * This is a geometric series that can be simplified to `S = 2^X+1 - 2`
 */
const MAX_PLANET_COUNT = FIRST_ORBIT_SECTOR_COUNT ** (MAX_ORBIT_COUNT + 1) - 2

export type StarSystemGenerationSettingsLimits = {
  [Key in keyof StarSystemGenerationSettings]: Range
}

export const StarSystemGenerationSettingsLimits: Readonly<StarSystemGenerationSettingsLimits> = {
  nbPlanets: Range.integer({ min: 1, max: MAX_PLANET_COUNT }),
  planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0, max: 1 }),
  nbMoonsPerPlanet: Range.integer({ min: 0, max: MAX_BODY_COUNT_PER_SECTOR - 1 }),
  nbAsteroidBelts: Range.integer({ min: 0, max: MAX_ORBIT_COUNT - 1 }),
  nbAsteroidsPerSector: Range.integer({ min: 0, max: MAX_BODY_COUNT_PER_SECTOR }),
  seed: Range.integer({ min: 0, max: MAX_UINT_32 }),
}
