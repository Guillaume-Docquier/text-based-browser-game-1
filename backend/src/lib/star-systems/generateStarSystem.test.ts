import { describe, expect, it } from "vitest"
import { Result } from "@guillaume-docquier/tools-ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { generateStarSystem } from "#lib/star-systems/generateStarSystem.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import type { NewStarSystem } from "#lib/db/star-systems/starSystems.repository.ts"

describe("generateStarSystem", () => {
  it("should return identical output for identical settings and seed", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 0.5, max: 0.5 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 1, max: 1 },
      nbAsteroidsPerSector: { min: 2, max: 2 },
      seed: 1234,
    })

    // Act
    const firstSystem = generateStarSystem({ gameId: 1, generationSettings })
    const secondSystem = generateStarSystem({ gameId: 1, generationSettings })

    // Assert
    expect(firstSystem).toEqual(secondSystem)
  })

  it("should place Planets differently for different seeds", () => {
    // Arrange
    const baseGenerationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 0.25, max: 0.25 },
      nbPlanets: { min: 1, max: 1 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
    })

    // Act
    const firstSystem = extractGeneratedSystem(
      generateStarSystem({ gameId: 1, generationSettings: { ...baseGenerationSettings, seed: 1 } }),
    )
    const secondSystem = extractGeneratedSystem(
      generateStarSystem({ gameId: 1, generationSettings: { ...baseGenerationSettings, seed: 2 } }),
    )

    // Assert
    expect(getPlanetSectorNumbers(firstSystem)).not.toEqual(getPlanetSectorNumbers(secondSystem))
  })

  it("should generate exact Body counts from fixed ranges", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 2, max: 2 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))

    // Assert
    expect(system.orbits).toHaveLength(1)
    expect(system.sectors).toHaveLength(2)
    expect(system.bodies.filter((body) => body.bodyType === BodyType.PLANET)).toHaveLength(2)
    expect(system.bodies.filter((body) => body.bodyType === BodyType.MOON)).toHaveLength(2)
  })

  it("should use the minimal Orbit count needed for fixed non-belt capacity", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))

    // Assert
    expect(system.orbits.map((orbit) => orbit.orbitNumber)).toEqual([1, 2])
  })

  it("should fill Asteroid belt Sectors with Asteroids only", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 0, max: 0 },
      nbPlanets: { min: 0, max: 0 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 1, max: 1 },
      nbAsteroidsPerSector: { min: 2, max: 2 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))

    // Assert
    expect(system.orbits).toHaveLength(1)
    expect(system.bodies).toHaveLength(4)
    expect(system.bodies.every((body) => body.bodyType === BodyType.ASTEROID)).toBe(true)
  })

  it("should create reciprocal MovementEdges", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 2, max: 2 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))

    // Assert
    for (const edge of system.movementEdges) {
      expect(system.movementEdges).toContainEqual({ fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId, weight: edge.weight })
    }
  })

  it("should create MovementNodes only for Sectors and Bodies", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 2, max: 2 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))
    const targetNodeIds = new Set([
      ...system.sectors.map((sector) => sector.movementNodeId),
      ...system.bodies.map((body) => body.movementNodeId),
    ])

    // Assert
    expect(system.movementNodes.map((node) => node.id).toSorted()).toEqual([...targetNodeIds].toSorted())
  })

  it("should connect doubled radial Sector adjacency", () => {
    // Arrange
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    })

    // Act
    const system = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings }))
    const innerSector = getSector({ system, orbitNumber: 1, sectorNumber: 1 })
    const firstOuterSector = getSector({ system, orbitNumber: 2, sectorNumber: 1 })
    const secondOuterSector = getSector({ system, orbitNumber: 2, sectorNumber: 2 })
    const thirdOuterSector = getSector({ system, orbitNumber: 2, sectorNumber: 3 })

    // Assert
    expect(system.movementEdges).toContainEqual({
      fromNodeId: innerSector.movementNodeId,
      toNodeId: firstOuterSector.movementNodeId,
      weight: 1,
    })
    expect(system.movementEdges).toContainEqual({
      fromNodeId: innerSector.movementNodeId,
      toNodeId: secondOuterSector.movementNodeId,
      weight: 1,
    })
    expect(system.movementEdges).not.toContainEqual({
      fromNodeId: innerSector.movementNodeId,
      toNodeId: thirdOuterSector.movementNodeId,
      weight: 1,
    })
  })
})

function extractGeneratedSystem(result: ReturnType<typeof generateStarSystem>): NewStarSystem {
  expect(result).toEqual(Result.Success(expect.any(Object)))
  if (Result.isFailure(result)) {
    throw new Error(result.error)
  }

  return result.value
}

function getPlanetSectorNumbers(system: NewStarSystem): number[] {
  return system.bodies
    .filter((body) => body.bodyType === BodyType.PLANET)
    .map((body) => system.sectors.find((sector) => sector.id === body.sectorId)?.sectorNumber)
    .filter((sectorNumber) => sectorNumber !== undefined)
}

function getSector({
  system,
  orbitNumber,
  sectorNumber,
}: {
  system: NewStarSystem
  orbitNumber: number
  sectorNumber: number
}): NewStarSystem["sectors"][number] {
  const orbit = system.orbits.find((candidateOrbit) => candidateOrbit.orbitNumber === orbitNumber)
  const sector = system.sectors.find(
    (candidateSector) => candidateSector.orbitId === orbit?.id && candidateSector.sectorNumber === sectorNumber,
  )
  expect(sector).toBeDefined()

  if (sector === undefined) {
    throw new Error(`Sector ${orbitNumber}:${sectorNumber} was not generated`)
  }

  return sector
}
