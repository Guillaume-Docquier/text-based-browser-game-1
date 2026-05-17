import { describe, expect, it } from "vitest"
import { Result } from "@guillaume-docquier/tools-ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import type { NewStarSystem } from "#lib/db/star-systems/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { generateStarSystem, MAX_ORBITS } from "#lib/star-systems/generateStarSystem.ts"

describe("generateStarSystem", () => {
  it("should return the same system for the same settings and seed", () => {
    const generationSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 1, max: 1 },
      seed: 1234,
    })

    const firstResult = generateStarSystem({ gameId: 1, generationSettings })
    const secondResult = generateStarSystem({ gameId: 1, generationSettings })

    expect(firstResult).toEqual(secondResult)
  })

  it("should place bodies differently with a different seed", () => {
    const baseSettings = createStarSystemGenerationSettingsStub({
      planetDensity: { min: 1, max: 1 },
      nbPlanets: { min: 3, max: 3 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
    })

    const firstSystem = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings: { ...baseSettings, seed: 1234 } }))
    const secondSystem = extractGeneratedSystem(generateStarSystem({ gameId: 1, generationSettings: { ...baseSettings, seed: 5678 } }))

    expect(toBodyPlacements(firstSystem)).not.toEqual(toBodyPlacements(secondSystem))
  })

  it("should generate exact body counts with fixed ranges", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 2, max: 2 },
          nbMoonsPerPlanet: { min: 2, max: 2 },
          nbAsteroidBelts: { min: 1, max: 1 },
          nbAsteroidsPerSector: { min: 1, max: 1 },
          seed: 1234,
        }),
      }),
    )

    expect(system.bodies.filter(({ bodyType }) => bodyType === BodyType.PLANET)).toHaveLength(2)
    expect(system.bodies.filter(({ bodyType }) => bodyType === BodyType.MOON)).toHaveLength(4)
    expect(system.bodies.filter(({ bodyType }) => bodyType === BodyType.ASTEROID).length).toBeGreaterThan(0)
  })

  it("should use the minimal orbit count needed to place planets", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 3, max: 3 },
          nbMoonsPerPlanet: { min: 0, max: 0 },
          nbAsteroidBelts: { min: 0, max: 0 },
          nbAsteroidsPerSector: { min: 0, max: 0 },
          seed: 1234,
        }),
      }),
    )

    expect(system.orbits).toHaveLength(2)
  })

  it("should keep asteroid belt sectors asteroid-only", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 1, max: 1 },
          nbMoonsPerPlanet: { min: 1, max: 1 },
          nbAsteroidBelts: { min: 1, max: 1 },
          nbAsteroidsPerSector: { min: 1, max: 1 },
          seed: 1234,
        }),
      }),
    )
    const bodiesBySectorId = Map.groupBy(system.bodies, ({ sectorId }) => sectorId)

    for (const bodies of bodiesBySectorId.values()) {
      const hasAsteroid = bodies.some(({ bodyType }) => bodyType === BodyType.ASTEROID)
      if (hasAsteroid) {
        expect(bodies.every(({ bodyType }) => bodyType === BodyType.ASTEROID)).toBe(true)
      }
    }
  })

  it("should generate reciprocal movement edges", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 2, max: 2 },
          nbMoonsPerPlanet: { min: 1, max: 1 },
          seed: 1234,
        }),
      }),
    )
    const edgeKeys = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}:${toNodeId}`))

    for (const edge of system.movementEdges) {
      expect(edgeKeys.has(`${edge.toNodeId}:${edge.fromNodeId}`)).toBe(true)
    }
  })

  it("should connect doubled orbit sectors with the documented radial adjacency rule", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 3, max: 3 },
          nbMoonsPerPlanet: { min: 0, max: 0 },
          nbAsteroidBelts: { min: 0, max: 0 },
          nbAsteroidsPerSector: { min: 0, max: 0 },
          seed: 1234,
        }),
      }),
    )
    const sector01 = getSectorByNumbers(system, { orbitNumber: 1, sectorNumber: 1 })
    const sector02 = getSectorByNumbers(system, { orbitNumber: 1, sectorNumber: 2 })
    const sector0101EdgeTargets = getEdgeTargets(system, sector01.movementNodeId)
    const sector0102EdgeTargets = getEdgeTargets(system, sector02.movementNodeId)

    expect(sector0101EdgeTargets).toEqual(
      expect.arrayContaining([
        getSectorByNumbers(system, { orbitNumber: 2, sectorNumber: 1 }).movementNodeId,
        getSectorByNumbers(system, { orbitNumber: 2, sectorNumber: 2 }).movementNodeId,
      ]),
    )
    expect(sector0102EdgeTargets).toEqual(
      expect.arrayContaining([
        getSectorByNumbers(system, { orbitNumber: 2, sectorNumber: 3 }).movementNodeId,
        getSectorByNumbers(system, { orbitNumber: 2, sectorNumber: 4 }).movementNodeId,
      ]),
    )
  })

  it("should create movement nodes only for sectors and bodies", () => {
    const system = extractGeneratedSystem(
      generateStarSystem({
        gameId: 1,
        generationSettings: createStarSystemGenerationSettingsStub({
          planetDensity: { min: 1, max: 1 },
          nbPlanets: { min: 2, max: 2 },
          nbMoonsPerPlanet: { min: 1, max: 1 },
          seed: 1234,
        }),
      }),
    )
    const movementTargetNodeIds = new Set([
      ...system.sectors.map(({ movementNodeId }) => movementNodeId),
      ...system.bodies.map(({ movementNodeId }) => movementNodeId),
    ])

    expect(system.movementNodes.map(({ id }) => id).toSorted()).toEqual([...movementTargetNodeIds].toSorted())
  })

  it("should fail when the orbit guard cannot satisfy generation settings", () => {
    const result = generateStarSystem({
      gameId: 1,
      generationSettings: createStarSystemGenerationSettingsStub({
        planetDensity: { min: 1, max: 1 },
        nbPlanets: { min: 1_000, max: 1_000 },
        nbMoonsPerPlanet: { min: 0, max: 0 },
        nbAsteroidBelts: { min: 0, max: 0 },
        nbAsteroidsPerSector: { min: 0, max: 0 },
        seed: 1234,
      }),
    })

    expect(result).toEqual(Result.Failure(`Cannot place 1000 planets within ${MAX_ORBITS} orbits`))
  })
})

function extractGeneratedSystem(result: Result<NewStarSystem, string>): NewStarSystem {
  if (Result.isFailure(result)) {
    throw new Error(String(result.error))
  }

  return result.value
}

function toBodyPlacements(system: NewStarSystem): string[] {
  const sectorsById = new Map(system.sectors.map((sector) => [sector.id, sector]))
  const orbitsById = new Map(system.orbits.map((orbit) => [orbit.id, orbit]))

  return system.bodies.map(({ bodyNumber, bodyType, sectorId }) => {
    const sector = sectorsById.get(sectorId)
    if (sector === undefined) {
      throw new Error(`Could not find sector ${sectorId}`)
    }

    const orbit = orbitsById.get(sector.orbitId)
    if (orbit === undefined) {
      throw new Error(`Could not find orbit ${sector.orbitId}`)
    }

    return `${orbit.orbitNumber}:${sector.sectorNumber}:${bodyNumber}:${bodyType}`
  })
}

function getSectorByNumbers(
  system: NewStarSystem,
  { orbitNumber, sectorNumber }: { orbitNumber: number; sectorNumber: number },
): NewStarSystem["sectors"][number] {
  const orbit = system.orbits.find((candidate) => candidate.orbitNumber === orbitNumber)
  if (orbit === undefined) {
    throw new Error(`Could not find orbit ${orbitNumber}`)
  }

  const sector = system.sectors.find((candidate) => candidate.orbitId === orbit.id && candidate.sectorNumber === sectorNumber)
  if (sector === undefined) {
    throw new Error(`Could not find sector ${orbitNumber}:${sectorNumber}`)
  }

  return sector
}

function getEdgeTargets(system: NewStarSystem, fromNodeId: string): string[] {
  return system.movementEdges.filter((edge) => edge.fromNodeId === fromNodeId).map(({ toNodeId }) => toNodeId)
}
