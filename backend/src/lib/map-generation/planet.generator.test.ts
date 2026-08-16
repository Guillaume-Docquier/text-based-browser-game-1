import { createRng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { BIOME_ATTRIBUTE_RANGES, planetGenerator, SIZE_ATTRIBUTE_RANGES } from "#lib/map-generation/planet.generator.ts"

describe("planetGenerator", () => {
  it("should generate a deterministic planet at the requested orbit distance", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistance = 8

    // Act
    const firstPlanet = planetGenerator(starPosition, orbitDistance, createSeededRng())
    const secondPlanet = planetGenerator(starPosition, orbitDistance, createSeededRng())

    // Assert
    expect(firstPlanet).toEqual(secondPlanet)
    expect(Math.hypot(firstPlanet.x - starPosition.x, firstPlanet.y - starPosition.y)).toBeCloseTo(orbitDistance, 5)
  })

  it("should place the planet at the angle selected by the rng", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistance = 8
    const quarterTurnRng = createRng(() => 0.25) // straight up, x should not change

    // Act
    const planet = planetGenerator(starPosition, orbitDistance, quarterTurnRng)

    // Assert
    expect(planet.y).toEqual(starPosition.y + orbitDistance)
    expect(Math.hypot(planet.x - starPosition.x, planet.y - starPosition.y)).toBeCloseTo(orbitDistance, 5)
  })

  it("should generate every biome with Attributes in its configured ranges", () => {
    // Arrange
    const rng = createSeededRng()

    // Act
    const planets = Array.from({ length: 5_000 }, () => planetGenerator({ x: 0, y: 0 }, 8, rng))

    // Assert
    expect(new Set(planets.map((planet) => planet.biome))).toEqual(new Set(Object.values(PlanetBiome)))
    for (const biome of Object.values(PlanetBiome)) {
      const biomePlanets = planets.filter((planet) => planet.biome === biome)
      const limits = BIOME_ATTRIBUTE_RANGES[biome]

      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.fertility)), limits.fertility)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.metal)), limits.metal)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.fuel)), limits.fuel)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.energy)), limits.energy)
    }
  })

  it("should generate every size with Attributes in its configured ranges", () => {
    // Arrange
    const rng = createSeededRng()

    // Act
    const planets = Array.from({ length: 5_000 }, () => planetGenerator({ x: 0, y: 0 }, 8, rng))

    // Assert
    expect(new Set(planets.map((planet) => planet.size))).toEqual(new Set(Object.values(PlanetSize)))
    for (const size of Object.values(PlanetSize)) {
      const sizePlanets = planets.filter((planet) => planet.size === size)
      const limits = SIZE_ATTRIBUTE_RANGES[size]

      expectToMatchLimits(getObservedRange(sizePlanets.map((planet) => planet.maxPopulation)), limits.maxPopulation)
      expectToMatchLimits(getObservedRange(sizePlanets.map((planet) => planet.area)), limits.area)
    }
  })

  it("should translate the generated planet with its star", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const translatedStarPosition = { x: 110, y: -95 }
    const translation = {
      x: translatedStarPosition.x - starPosition.x,
      y: translatedStarPosition.y - starPosition.y,
    }

    // Act
    const planet = planetGenerator(starPosition, 8, createSeededRng())
    const translatedPlanet = planetGenerator(translatedStarPosition, 8, createSeededRng())

    // Assert
    expect(translatedPlanet).toEqual({
      ...planet,
      x: expect.closeTo(planet.x + translation.x, 10),
      y: expect.closeTo(planet.y + translation.y, 10),
    })
  })
})

type NumericRange = {
  readonly min: number
  readonly max: number
}

function getObservedRange(values: readonly number[]): NumericRange {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function expectToMatchLimits(observed: NumericRange, limits: NumericRange): void {
  expect(observed.min).toEqual(limits.min)
  expect(observed.max).toEqual(limits.max)
}
