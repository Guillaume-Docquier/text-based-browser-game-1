import { Range } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"

export type StarSystemGenerationSettingsLimits = {
  [Key in keyof StarSystemGenerationSettings]: Range
}

export function createStarSystemGenerationSettingsLimits(): StarSystemGenerationSettingsLimits {
  return {
    planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0, max: 1 }),
    nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 100 }),
    nbMoonsPerPlanet: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 10 }),
    nbAsteroidBelts: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 10 }),
    nbAsteroidsPerSector: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 10 }),
    seed: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 0xffffffff }),
  }
}
