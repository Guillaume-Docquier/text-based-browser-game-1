import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { planetGenerator } from "#lib/map/planet.generator.ts"

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
        name: "planet 703708",
      },
      secondPlanet: {
        x: 17.166551105169326,
        y: -16.444645551144536,
        name: "planet 703708",
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
    })
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
      x: expect.closeTo(planet.x + translation.x, 10),
      y: expect.closeTo(planet.y + translation.y, 10),
      name: planet.name,
    })
  })
})
