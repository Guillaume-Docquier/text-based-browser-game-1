import { createRng, Distance, mulberry32Prng, type Rng, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
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
    expect(firstSystem.star).toMatchObject(origin)
  })

  it("should generate a system around the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }

    // Act
    const system = systemGenerator(origin, createSeededRng())

    // Assert
    expect(system).toEqual<typeof system>({
      star: { ...origin, name: expect.any(String) },
      planets: [
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.METALLIC,
          size: PlanetSize.LARGE,
          fertility: 1,
          metal: 4,
          fuel: 1,
          energy: 3,
          maxPopulation: 20,
          area: 11,
        },
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.OCEANIC,
          size: PlanetSize.SMALL,
          fertility: 4,
          metal: 1,
          fuel: 2,
          energy: 2,
          maxPopulation: 6,
          area: 3,
        },
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.OCEANIC,
          size: PlanetSize.MEDIUM,
          fertility: 2,
          metal: 2,
          fuel: 3,
          energy: 1,
          maxPopulation: 20,
          area: 4,
        },
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.FROZEN,
          size: PlanetSize.SMALL,
          fertility: 1,
          metal: 3,
          fuel: 4,
          energy: 2,
          maxPopulation: 7,
          area: 4,
        },
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.FROZEN,
          size: PlanetSize.LARGE,
          fertility: 2,
          metal: 2,
          fuel: 2,
          energy: 2,
          maxPopulation: 33,
          area: 9,
        },
        {
          x: expect.closeTo(origin.x),
          y: expect.closeTo(origin.y),
          name: expect.any(String),
          biome: PlanetBiome.VOLCANIC,
          size: PlanetSize.LARGE,
          fertility: 2,
          metal: 1,
          fuel: 2,
          energy: 2,
          maxPopulation: 27,
          area: 10,
        },
      ],
    })
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
