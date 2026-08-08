import { createRng, Distance, mulberry32Prng, type Rng, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { systemGenerator } from "#lib/map-generation/system.generator.ts"

describe("systemGenerator", () => {
  function createSeededRng(): Rng {
    return createRng(mulberry32Prng(2))
  }

  it("should generate a deterministic system at the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const firstSystem = systemGenerator(origin, createSeededRng())
    const secondSystem = systemGenerator(origin, createSeededRng())

    // Assert
    expect(firstSystem).toEqual(secondSystem)
  })

  it("should generate a system around the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const system = systemGenerator(origin, createSeededRng())

    // Assert
    expect(system.star).toEqual<typeof system.star>({ ...origin, name: expect.any(String) })
    expect(system.planets).toEqual<typeof system.planets>([
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
      { x: expect.closeTo(origin.x), y: expect.closeTo(origin.y), name: expect.any(String) },
    ])
  })

  it("should generate planets on distinct valid orbits", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const system = systemGenerator(origin, createSeededRng())
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
