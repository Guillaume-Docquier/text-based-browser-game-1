import type { StarSystemGenerationSettingsDto } from "#api/games/games.controller.ts"

export function createStarSystemGenerationSettingsDtoStub(
  overrides?: Partial<StarSystemGenerationSettingsDto>,
): StarSystemGenerationSettingsDto {
  return {
    planetDensity: { min: 0.4, max: 0.6 },
    nbPlanets: { min: 9, max: 11 },
    nbMoonsPerPlanet: { min: 1, max: 3 },
    nbAsteroidBelts: { min: 1, max: 1 },
    nbAsteroidsPerSector: { min: 1, max: 3 },
    ...overrides,
  }
}
