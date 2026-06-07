import type { MapGenerationSettings } from "./MapGenerationSettings.ts"
import { Range } from "@guillaume-docquier/tools-ts"

export function createMapGenerationSettingsStub(overrides?: Partial<MapGenerationSettings>): MapGenerationSettings {
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
