import type { StarSystemGenerationSettingsDto } from "#api/games/games.controller.ts"

export function createStarSystemGenerationSettingsDtoStub(
  overrides?: Partial<StarSystemGenerationSettingsDto>,
): StarSystemGenerationSettingsDto {
  return {
    planetDensity: { min: 0.5, max: 0.5 },
    nbPlanets: { min: 1, max: 1 },
    nbMoonsPerPlanet: { min: 0, max: 0 },
    nbAsteroidBelts: { min: 0, max: 0 },
    nbAsteroidsPerSector: { min: 0, max: 0 },
    ...overrides,
  }
}
