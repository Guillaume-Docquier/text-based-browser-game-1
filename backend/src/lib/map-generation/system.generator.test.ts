import { Distance, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { systemGenerator } from "#lib/map-generation/system.generator.ts"

describe("systemGenerator", () => {
  it("should generate a deterministic system at the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const firstSystem = systemGenerator(origin, createSeededRng())
    const secondSystem = systemGenerator(origin, createSeededRng())

    // Assert
    expect(firstSystem).toEqual(secondSystem)
    expect(firstSystem.star).toMatchObject(origin)
  })

  it("should generate a system around the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const system = systemGenerator(origin, createSeededRng(2))

    // Assert
    expect(system).toEqual<typeof system>({
      star: expect.objectContaining(origin),
      planets: [
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
        expect.objectContaining({ x: expect.closeTo(origin.x), y: expect.closeTo(origin.y) }),
      ],
    })
  })

  it("should generate planets on distinct valid orbits", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const system = systemGenerator(origin, createSeededRng(2))
    const orbitsInAstronomicalUnits = system.planets
      .map((planet) => {
        const orbitInLightYears = Distance.create(Math.hypot(planet.x - origin.x, planet.y - origin.y), UnitOfDistance.LIGHT_YEARS)
        return Math.round(Distance.convert(orbitInLightYears, UnitOfDistance.ASTRONOMICAL_UNITS).value)
      })
      // oxlint-disable-next-line unicorn/no-array-sort -- We're working on a controlled copy, we don't need another one
      .sort((left, right) => left - right)

    // Assert
    expect(orbitsInAstronomicalUnits).toEqual([5, 10, 30, 40, 45, 50])
  })
})
