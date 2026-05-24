import { describe, expect, it } from "vitest"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { generateStarSystem } from "#lib/star-systems/generateStarSystem.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import type { NewStarSystem } from "#lib/db/star-systems/starSystems.repository.ts"

describe("generateStarSystem", () => {
  it("should return identical output for the same settings and seed", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 1, max: 1 },
      nbAsteroidsPerSector: { min: 1, max: 1 },
      seed: 1234,
    })

    // Act
    const firstSystem = generateStarSystem(settings)
    const secondSystem = generateStarSystem(settings)

    // Assert
    expect(firstSystem).toEqual(secondSystem)
  })

  it("should place Bodies differently for different seeds", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
    })

    // Act
    const firstSystem = extractSuccess(generateStarSystem({ ...settings, seed: 1 }))
    const secondSystem = extractSuccess(generateStarSystem({ ...settings, seed: 2 }))

    // Assert
    expect(toBodySectorNumbers(firstSystem)).not.toEqual(toBodySectorNumbers(secondSystem))
  })

  it("should respect exact Body counts with min=max ranges", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 2, max: 2 },
      nbMoonsPerPlanet: { min: 2, max: 2 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))

    // Assert
    expect(countBodiesByType(system)).toEqual({
      [BodyType.PLANET]: 2,
      [BodyType.MOON]: 4,
      [BodyType.ASTEROID]: 0,
    })
  })

  it("should use the minimal number of Orbits needed for Planet capacity", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))

    // Assert
    expect(system.orbits.map((orbit) => orbit.orbitNumber)).toEqual([1, 2])
  })

  it("should add an Orbit when the rolled Asteroid belt leaves too little Planet capacity", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 1, max: 1 },
      nbAsteroidsPerSector: { min: 1, max: 1 },
      seed: 3,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))

    // Assert
    expect(system.orbits.map((orbit) => orbit.orbitNumber)).toEqual([1, 3, 2])
  })

  it("should fill Asteroid belts with only Asteroids", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 0, max: 0 },
      nbPlanets: { min: 0, max: 0 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 1, max: 1 },
      nbAsteroidsPerSector: { min: 2, max: 2 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))

    // Assert
    expect(system.bodies).not.toHaveLength(0)
    expect(system.bodies.every((body) => body.bodyType === BodyType.ASTEROID)).toBe(true)
  })

  it("should create reciprocal MovementEdges", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))
    const edgeKeys = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}->${toNodeId}`))

    // Assert
    expect(system.movementEdges.every(({ fromNodeId, toNodeId }) => edgeKeys.has(`${toNodeId}->${fromNodeId}`))).toBe(true)
  })

  it("should create MovementNodes only for Sectors and Bodies", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 2, max: 2 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))
    const targetMovementNodeIds = [
      ...system.sectors.map((sector) => sector.movementNodeId),
      ...system.bodies.map((body) => body.movementNodeId),
    ].toSorted()

    // Assert
    expect(system.movementNodes.map((node) => node.id).toSorted()).toEqual(targetMovementNodeIds)
    expect(new Set(targetMovementNodeIds).size).toBe(targetMovementNodeIds.length)
  })

  it("should connect radial Sector adjacency to the two matching Sectors in the doubled outer Orbit", () => {
    // Arrange
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractSuccess(generateStarSystem(settings))
    const sectorNodeIdsByCoordinate = new Map(
      system.sectors.map((sector) => {
        const orbit = system.orbits.find((candidate) => candidate.id === sector.orbitId)
        if (orbit === undefined) {
          throw new Error("Sector references an unknown Orbit")
        }

        return [`${orbit.orbitNumber}:${sector.sectorNumber}`, sector.movementNodeId]
      }),
    )
    const edgeKeys = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}->${toNodeId}`))

    // Assert
    expect(edgeKeys).toContain(`${sectorNodeIdsByCoordinate.get("1:1")}->${sectorNodeIdsByCoordinate.get("2:1")}`)
    expect(edgeKeys).toContain(`${sectorNodeIdsByCoordinate.get("1:1")}->${sectorNodeIdsByCoordinate.get("2:2")}`)
    expect(edgeKeys).toContain(`${sectorNodeIdsByCoordinate.get("1:2")}->${sectorNodeIdsByCoordinate.get("2:3")}`)
    expect(edgeKeys).toContain(`${sectorNodeIdsByCoordinate.get("1:2")}->${sectorNodeIdsByCoordinate.get("2:4")}`)
  })
})

function toBodySectorNumbers(system: Omit<NewStarSystem, "gameId">): number[] {
  const sectorNumbersById = new Map(system.sectors.map((sector) => [sector.id, sector.sectorNumber]))

  return system.bodies.map((body) => {
    const sectorNumber = sectorNumbersById.get(body.sectorId)
    if (sectorNumber === undefined) {
      throw new Error("Body references an unknown Sector")
    }

    return sectorNumber
  })
}

function countBodiesByType(system: Omit<NewStarSystem, "gameId">): Record<BodyType, number> {
  return {
    [BodyType.PLANET]: system.bodies.filter((body) => body.bodyType === BodyType.PLANET).length,
    [BodyType.MOON]: system.bodies.filter((body) => body.bodyType === BodyType.MOON).length,
    [BodyType.ASTEROID]: system.bodies.filter((body) => body.bodyType === BodyType.ASTEROID).length,
  }
}
