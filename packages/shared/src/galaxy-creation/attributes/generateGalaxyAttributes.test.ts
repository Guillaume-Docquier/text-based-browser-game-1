import { describe, expect, it } from "vitest"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"
import { generateGalaxyAttributes } from "#shared/galaxy-creation/attributes/generateGalaxyAttributes.ts"
import { PLANET_AREA_RANGES } from "#shared/galaxy-creation/attributes/generatePlanetAttributes.ts"
import { createGalaxyTopologyStub } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("generateGalaxyAttributes", () => {
  it("should generate every biome", () => {
    // Arrange
    const galaxyTopology = createGalaxyTopologyStub()
    const rng = createSeededRng()

    // Act
    const galaxy = generateGalaxyAttributes({ galaxyTopology, rng })
    const planets = galaxy.systems.flatMap((system) => system.planets)

    // Assert
    expect(new Set(planets.map((planet) => planet.biome))).toStrictEqual(new Set(Object.values(PlanetBiome)))
  })

  it("should generate every size with attributes in its configured ranges", () => {
    // Arrange
    const galaxyTopology = createGalaxyTopologyStub()
    const rng = createSeededRng()

    // Act
    const galaxy = generateGalaxyAttributes({ galaxyTopology, rng })
    const planets = galaxy.systems.flatMap((system) => system.planets)

    // Assert
    expect(new Set(planets.map((planet) => planet.size))).toStrictEqual(new Set(Object.values(PlanetSize)))
    for (const size of Object.values(PlanetSize)) {
      const sizePlanets = planets.filter((planet) => planet.size === size)
      const limits = PLANET_AREA_RANGES[size]

      expectToMatchLimits(getObservedRange(sizePlanets.map((planet) => planet.area)), limits)
    }
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
  expect(observed.min).toStrictEqual(limits.min)
  expect(observed.max).toStrictEqual(limits.max)
}
