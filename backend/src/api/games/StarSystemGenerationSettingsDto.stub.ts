import type { StarSystemGenerationSettingsDto } from "#api/games/games.controller.ts"
import { Range } from "@guillaume-docquier/tools-ts"

export function createStarSystemGenerationSettingsDtoStub(
  overrides?: Partial<StarSystemGenerationSettingsDto>,
): StarSystemGenerationSettingsDto {
  return {
    planetDensity: Range.createMaxInclusive({ min: 0.4, maxInclusive: 0.6, numericType: "float" }),
    nbPlanets: Range.createMaxInclusive({ min: 9, maxInclusive: 11, numericType: "integer" }),
    nbMoonsPerPlanet: Range.createMaxInclusive({ min: 1, maxInclusive: 3, numericType: "integer" }),
    nbAsteroidBelts: Range.createMaxInclusive({ min: 1, maxInclusive: 1, numericType: "integer" }),
    nbAsteroidsPerSector: Range.createMaxInclusive({ min: 1, maxInclusive: 3, numericType: "integer" }),
    ...overrides,
  }
}
