import { Range } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"
import { randomUInt32 } from "#lib/randomUInt32.ts"

export function createStarSystemGenerationSettingsDefaults(): StarSystemGenerationSettings {
  return {
    planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0.75, max: 0.85 }),
    nbPlanets: Range.integer({ min: 5, max: 8 }),
    nbMoonsPerPlanet: Range.integer({ min: 1, max: 3 }),
    nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
    nbAsteroidsPerSector: Range.integer({ min: 1, max: 3 }),
    seed: randomUInt32(),
  }
}
