import { describe, expect, it } from "vitest"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"
import { generateGalaxyAttributes } from "#shared/galaxy-creation/attributes/generateGalaxyAttributes.ts"
import { BIOME_ATTRIBUTE_RANGES, SIZE_ATTRIBUTE_RANGES } from "#shared/galaxy-creation/attributes/generatePlanetAttributes.ts"
import { createGalaxyTopologyStub } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("generateGalaxyAttributes", () => {
  it("should generate every biome with attributes in its configured ranges", () => {
    // Arrange
    const galaxyTopology = createGalaxyTopologyStub()
    const rng = createSeededRng()

    // Act
    const galaxy = generateGalaxyAttributes({ galaxyTopology, rng })
    const planets = galaxy.systems.flatMap((system) => system.planets)

    // Assert
    expect(new Set(planets.map((planet) => planet.biome))).toStrictEqual(new Set(Object.values(PlanetBiome)))
    for (const biome of Object.values(PlanetBiome)) {
      const biomePlanets = planets.filter((planet) => planet.biome === biome)
      const limits = BIOME_ATTRIBUTE_RANGES[biome]

      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.fertility)), limits.fertility)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.metal)), limits.metal)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.fuel)), limits.fuel)
      expectToMatchLimits(getObservedRange(biomePlanets.map((planet) => planet.energy)), limits.energy)
    }
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
      const limits = SIZE_ATTRIBUTE_RANGES[size]

      expectToMatchLimits(getObservedRange(sizePlanets.map((planet) => planet.maxPopulation)), limits.maxPopulation)
      expectToMatchLimits(getObservedRange(sizePlanets.map((planet) => planet.area)), limits.area)
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
