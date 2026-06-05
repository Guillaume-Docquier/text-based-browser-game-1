import type { Range } from "@guillaume-docquier/tools-ts"

export type StarSystemGenerationSettings = {
  planetDensity: Range
  nbPlanets: Range
  nbMoonsPerPlanet: Range
  nbAsteroidBelts: Range
  nbAsteroidsPerSector: Range
  seed: number
}
