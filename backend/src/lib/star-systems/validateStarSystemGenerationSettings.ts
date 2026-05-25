import type { StarSystemGenerationSettingsDto } from "#api/games/games.controller.ts"
import { Result } from "@guillaume-docquier/tools-ts"
import { MAX_ORBITS } from "#lib/star-systems/generateStarSystem.ts"

export function validateStarSystemGenerationSettings(settings: Readonly<StarSystemGenerationSettingsDto>): Result<true, string> {
  const rangeChecks = [
    ["planetDensity", settings.planetDensity],
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ] as const

  for (const [rangeName, range] of rangeChecks) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.maxInclusive)) {
      return Result.Failure(`${rangeName} must have finite bounds`)
    }

    if (range.min > range.maxInclusive) {
      return Result.Failure(`${rangeName} min must be less than or equal to max`)
    }
  }

  if (settings.planetDensity.min < 0 || settings.planetDensity.maxInclusive > 1) {
    return Result.Failure("planetDensity must stay between 0 and 1")
  }

  const integerRanges = [
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ] as const

  for (const [rangeName, range] of integerRanges) {
    if (!Number.isInteger(range.min) || !Number.isInteger(range.maxInclusive)) {
      return Result.Failure(`${rangeName} must use integer bounds`)
    }

    if (range.min < 0) {
      return Result.Failure(`${rangeName} must be greater than or equal to 0`)
    }
  }

  if (settings.seed !== undefined && (!Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 2 ** 32 - 1)) {
    return Result.Failure("seed must be an unsigned 32-bit integer")
  }

  if (settings.nbAsteroidBelts.maxInclusive > MAX_ORBITS) {
    return Result.Failure(`nbAsteroidBelts cannot be greater than ${MAX_ORBITS}`)
  }

  const maxNonBeltSectorCount = Array.from({ length: MAX_ORBITS }, (_, index) => 2 ** (index + 1))
    .toSorted((sectorCountA, sectorCountB) => sectorCountB - sectorCountA)
    .slice(0, MAX_ORBITS - settings.nbAsteroidBelts.maxInclusive)
    .reduce((total, sectorCount) => total + sectorCount, 0)
  const maxPlanetCapacity = Math.floor(maxNonBeltSectorCount * settings.planetDensity.min)

  if (maxPlanetCapacity < settings.nbPlanets.maxInclusive) {
    return Result.Failure(`settings cannot generate the requested Planets within ${MAX_ORBITS} orbits`)
  }

  return Result.Success(true)
}
