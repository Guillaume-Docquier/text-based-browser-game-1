import { Range } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettings } from "./StarSystemGenerationSettings.ts"

export function createStarSystemGenerationSettingsStub(overrides?: Partial<StarSystemGenerationSettings>): StarSystemGenerationSettings {
  return {
    planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0.4, max: 0.6 }),
    nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 9, max: 11 }),
    nbMoonsPerPlanet: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 3 }),
    nbAsteroidBelts: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
    nbAsteroidsPerSector: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 3 }),
    seed: 1234,
    ...overrides,
  }
}
