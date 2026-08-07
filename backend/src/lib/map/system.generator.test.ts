import { createRng, Distance, mulberry32Prng, type Rng, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { systemGenerator } from "#lib/map/system.generator.ts"

describe("systemGenerator", () => {
  function createSeededRng(): Rng {
    return createRng(mulberry32Prng(2))
  }

  it("should generate a deterministic system at the requested origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }
    const expectedSystem = {
      star: { x: 10, y: -20, name: "star 948889" },
      planets: [
        { x: 10.000114069191861, y: -19.999945314677785, name: "planet 714382" },
        { x: 10.000580463031698, y: -20.00007321965954, name: "planet 839037" },
        { x: 9.999970127786828, y: -20.000036850636295, name: "planet 524895" },
        { x: 10.000309420820958, y: -19.999934632486724, name: "planet 848925" },
        { x: 10.000259612659846, y: -20.000415794753696, name: "planet 548436" },
        { x: 9.999933434573292, y: -19.999839303620988, name: "planet 902674" },
        { x: 10.000569492398819, y: -20.0002751999866, name: "planet 447505" },
      ],
    }

    // Act
    const firstSystem = systemGenerator(origin, createSeededRng())
    const secondSystem = systemGenerator(origin, createSeededRng())

    // Assert
    expect({ firstSystem, secondSystem }).toEqual({
      firstSystem: expectedSystem,
      secondSystem: expectedSystem,
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
    expect(orbitsInAstronomicalUnits).toEqual([3, 8, 11, 20, 31, 37, 40])
  })

  it("should translate the generated system with its origin", () => {
    // Arrange
    const translatedOrigin = { x: 110, y: -95 }

    // Act
    const translatedSystem = systemGenerator(translatedOrigin, createSeededRng())

    // Assert
    expect(translatedSystem).toEqual({
      star: { x: 110, y: -95, name: "star 948889" },
      planets: [
        { x: 110.00011406919187, y: -94.99994531467779, name: "planet 714382" },
        { x: 110.0005804630317, y: -95.00007321965954, name: "planet 839037" },
        { x: 109.99997012778682, y: -95.00003685063629, name: "planet 524895" },
        { x: 110.00030942082095, y: -94.99993463248673, name: "planet 848925" },
        { x: 110.00025961265985, y: -95.00041579475369, name: "planet 548436" },
        { x: 109.9999334345733, y: -94.99983930362099, name: "planet 902674" },
        { x: 110.00056949239882, y: -95.0002751999866, name: "planet 447505" },
      ],
    })
  })
})
