import type { StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"

export function createStarSystemGenerationSettingsStub(overrides?: Partial<StarSystemGenerationSettings>): StarSystemGenerationSettings {
  return {
    planetDensity: { min: 0.5, max: 0.5 },
    nbPlanets: { min: 1, max: 1 },
    nbMoonsPerPlanet: { min: 0, max: 0 },
    nbAsteroidBelts: { min: 0, max: 0 },
    nbAsteroidsPerSector: { min: 0, max: 0 },
    seed: 1234,
    ...overrides,
  }
}
