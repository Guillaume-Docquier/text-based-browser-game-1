import { Range } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettings } from "#api/star-systems/StarSystemGenerationSettings.ts"

function randomUInt32(): number {
  return Math.floor(Math.random() * 0x100000000)
}

export function createDefaultStarSystemGenerationSettings(): StarSystemGenerationSettings {
  return {
    planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0.4, max: 0.6 }),
    nbPlanets: Range.integer({ min: 9, max: 11 }),
    nbMoonsPerPlanet: Range.integer({ min: 1, max: 3 }),
    nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
    nbAsteroidsPerSector: Range.integer({ min: 1, max: 3 }),
    seed: randomUInt32(),
  }
}
