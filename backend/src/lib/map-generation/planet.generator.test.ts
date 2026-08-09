import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { planetGenerator } from "#lib/map-generation/planet.generator.ts"

describe("planetGenerator", () => {
  function createSeededRng(): Rng {
    return createRng(mulberry32Prng(1234))
  }

  it("should generate a deterministic planet at the requested orbit distance", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistance = 8

    // Act
    const firstPlanet = planetGenerator(starPosition, orbitDistance, createSeededRng())
    const secondPlanet = planetGenerator(starPosition, orbitDistance, createSeededRng())

    // Assert
    expect({ firstPlanet, secondPlanet }).toEqual({
      firstPlanet: {
        x: 17.166551105169326,
        y: -16.444645551144536,
        name: "planet 970578",
        biome: PlanetBiome.FROZEN,
        size: PlanetSize.LARGE,
        food: 1,
        metal: 1,
        fuel: 2,
        energy: 2,
        maxPopulation: 26,
        area: 7,
      },
      secondPlanet: {
        x: 17.166551105169326,
        y: -16.444645551144536,
        name: "planet 970578",
        biome: PlanetBiome.FROZEN,
        size: PlanetSize.LARGE,
        food: 1,
        metal: 1,
        fuel: 2,
        energy: 2,
        maxPopulation: 26,
        area: 7,
      },
    })
  })

  it("should place the planet at the angle selected by the rng", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistance = 8
    const quarterTurnRng = createRng(() => 0.25)

    // Act
    const planet = planetGenerator(starPosition, orbitDistance, quarterTurnRng)

    // Assert
    expect(planet).toEqual({
      x: expect.closeTo(10, 10),
      y: -12,
      name: "planet 250749",
      biome: PlanetBiome.METALLIC,
      size: PlanetSize.SMALL,
      food: 1,
      metal: 2,
      fuel: 1,
      energy: 1,
      maxPopulation: 6,
      area: 2,
    })
  })

  it("should generate every biome and size with independent Attributes in their configured ranges", () => {
    // Arrange
    const cases = [
      { biomeRoll: 0, sizeRoll: 0 },
      { biomeRoll: 0.25, sizeRoll: 1 / 3 },
      { biomeRoll: 0.5, sizeRoll: 2 / 3 },
      { biomeRoll: 0.75, sizeRoll: 0 },
    ]

    // Act
    const planets = cases.map(({ biomeRoll, sizeRoll }) =>
      planetGenerator({ x: 0, y: 0 }, 8, createSequenceRng([0, biomeRoll, sizeRoll, 0.999_999, 0, 0.2, 0.4, 0.6, 0.8, 0.999_999])),
    )

    // Assert
    expect(planets).toEqual([
      {
        x: 8,
        y: 0,
        name: "planet 999999",
        biome: PlanetBiome.OCEANIC,
        size: PlanetSize.SMALL,
        food: 2,
        metal: 1,
        fuel: 2,
        energy: 2,
        maxPopulation: 9,
        area: 4,
      },
      {
        x: 8,
        y: 0,
        name: "planet 999999",
        biome: PlanetBiome.METALLIC,
        size: PlanetSize.MEDIUM,
        food: 1,
        metal: 2,
        fuel: 1,
        energy: 2,
        maxPopulation: 18,
        area: 7,
      },
      {
        x: 8,
        y: 0,
        name: "planet 999999",
        biome: PlanetBiome.FROZEN,
        size: PlanetSize.LARGE,
        food: 1,
        metal: 1,
        fuel: 3,
        energy: 2,
        maxPopulation: 32,
        area: 11,
      },
      {
        x: 8,
        y: 0,
        name: "planet 999999",
        biome: PlanetBiome.VOLCANIC,
        size: PlanetSize.SMALL,
        food: 2,
        metal: 1,
        fuel: 1,
        energy: 3,
        maxPopulation: 9,
        area: 4,
      },
    ])
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

function createSequenceRng(values: readonly number[]): Rng {
  let index = 0

  return createRng(() => {
    const value = values[index]
    if (value === undefined) {
      throw new Error("The test RNG sequence was exhausted")
    }

    index++
    return value
  })
}
