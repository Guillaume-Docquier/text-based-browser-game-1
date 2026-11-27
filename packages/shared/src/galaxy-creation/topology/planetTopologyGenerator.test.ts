import { Distance, UnitOfDistance, Rng, createGeneratorStub } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { planetTopologyGenerator } from "#shared/galaxy-creation/topology/planetTopologyGenerator.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("planetTopologyGenerator", () => {
  it("should generate a deterministic planet at the requested orbit distance", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistanceAU = 8
    const radiusLightYears = Distance.in(Distance.create(orbitDistanceAU, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS)

    // Act
    const firstPlanet = planetTopologyGenerator(starPosition, orbitDistanceAU, createSeededRng())
    const secondPlanet = planetTopologyGenerator(starPosition, orbitDistanceAU, createSeededRng())

    // Assert
    expect(firstPlanet).toStrictEqual(secondPlanet)
    expect(firstPlanet.orbitDistanceAU).toBe(orbitDistanceAU)
    expect(Math.hypot(firstPlanet.x - starPosition.x, firstPlanet.y - starPosition.y)).toBeCloseTo(radiusLightYears, 12)
  })

  it("should place the planet at the angle selected by the rng", () => {
    // Arrange
    const starPosition = { x: 10, y: -20 }
    const orbitDistanceAU = 8
    const radiusLightYears = Distance.in(Distance.create(orbitDistanceAU, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS)
    const quarterTurnRng = Rng.create(createGeneratorStub(0.25))

    // Act
    const planet = planetTopologyGenerator(starPosition, orbitDistanceAU, quarterTurnRng)

    // Assert
    expect(planet.y).toStrictEqual(starPosition.y + radiusLightYears)
    expect(Math.hypot(planet.x - starPosition.x, planet.y - starPosition.y)).toBeCloseTo(radiusLightYears, 12)
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
    const planet = planetTopologyGenerator(starPosition, 8, createSeededRng())
    const translatedPlanet = planetTopologyGenerator(translatedStarPosition, 8, createSeededRng())

    // Assert
    expect(translatedPlanet).toStrictEqual({
      ...planet,
      x: expect.closeTo(planet.x + translation.x, 10),
      y: expect.closeTo(planet.y + translation.y, 10),
    })
  })
})
