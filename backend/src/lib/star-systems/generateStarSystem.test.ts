import { Range, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { NewStarSystemModel } from "#api/gameplay/gameplay.repository.ts"
import { createStarSystemGenerationSettingsStub } from "#api/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { BodyType } from "./BodyType.ts"
import { generateStarSystem } from "./generateStarSystem.ts"

describe("generateStarSystem", () => {
  it("should generate identical Star Systems from identical settings", () => {
    const settings = createStarSystemGenerationSettingsStub({ seed: 1234 })

    const firstResult = generateStarSystem(settings)
    const secondResult = generateStarSystem(settings)

    expect(secondResult).toEqual(firstResult)
  })

  it("should generate different planet placement from different seeds", () => {
    const firstSystem = extractSuccess(generateStarSystem(createStarSystemGenerationSettingsStub({ seed: 1 })))
    const secondSystem = extractSuccess(generateStarSystem(createStarSystemGenerationSettingsStub({ seed: 2 })))

    expect(getBodyLocations(firstSystem, BodyType.PLANET)).not.toEqual(getBodyLocations(secondSystem, BodyType.PLANET))
  })

  it("should generate exact body counts and one complete Asteroid belt", () => {
    const system = extractSuccess(
      generateStarSystem(
        createStarSystemGenerationSettingsStub({
          nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 5, max: 5 }),
          nbMoonsPerPlanet: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 2, max: 2 }),
          nbAsteroidBelts: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
          nbAsteroidsPerSector: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 2, max: 2 }),
        }),
      ),
    )

    const planets = system.bodies.filter(({ bodyType }) => bodyType === BodyType.PLANET)
    const moons = system.bodies.filter(({ bodyType }) => bodyType === BodyType.MOON)
    const asteroidSectorIds = new Set(
      system.bodies.filter(({ bodyType }) => bodyType === BodyType.ASTEROID).map(({ sectorId }) => sectorId),
    )
    const sectorsByOrbitId = Map.groupBy(system.sectors, ({ orbitId }) => orbitId)
    const asteroidBeltOrbits = system.orbits.filter(({ id }) =>
      (sectorsByOrbitId.get(id) ?? []).every(({ id: sectorId }) => asteroidSectorIds.has(sectorId)),
    )

    expect(planets).toHaveLength(5)
    expect(moons).toHaveLength(10)
    expect(asteroidBeltOrbits).toHaveLength(1)

    for (const sector of sectorsByOrbitId.get(asteroidBeltOrbits[0]?.id ?? "") ?? []) {
      expect(system.bodies.filter(({ sectorId }) => sectorId === sector.id)).toHaveLength(2)
      expect(system.bodies.filter(({ sectorId }) => sectorId === sector.id).every(({ bodyType }) => bodyType === BodyType.ASTEROID)).toBe(
        true,
      )
    }
  })

  it("should create reciprocal movement edges and one node per Sector and Body", () => {
    const system = extractSuccess(generateStarSystem(createStarSystemGenerationSettingsStub()))
    const edges = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}:${toNodeId}`))

    expect(system.movementNodes).toHaveLength(system.sectors.length + system.bodies.length)
    for (const edge of system.movementEdges) {
      expect(edges.has(`${edge.toNodeId}:${edge.fromNodeId}`)).toBe(true)
    }
  })

  it("should allow the outermost Orbit to be an Asteroid belt", () => {
    const system = extractSuccess(
      generateStarSystem(
        createStarSystemGenerationSettingsStub({
          planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 1, max: 1 }),
          nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 2, max: 2 }),
          nbMoonsPerPlanet: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 0 }),
          nbAsteroidBelts: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
          nbAsteroidsPerSector: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
          seed: 0,
        }),
      ),
    )
    const outerOrbit = system.orbits.at(-1)
    const outerSectorIds = new Set(system.sectors.filter(({ orbitId }) => orbitId === outerOrbit?.id).map(({ id }) => id))

    expect(
      system.bodies.filter(({ sectorId }) => outerSectorIds.has(sectorId)).every(({ bodyType }) => bodyType === BodyType.ASTEROID),
    ).toBe(true)
  })

  it("should connect Sectors when their angle ranges share a border", () => {
    const system = extractSuccess(
      generateStarSystem(
        createStarSystemGenerationSettingsStub({
          planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0.2, max: 0.2 }),
          nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
          nbMoonsPerPlanet: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 0 }),
          nbAsteroidBelts: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 0 }),
        }),
      ),
    )
    const orbitNumbersById = new Map(system.orbits.map(({ id, orbitNumber }) => [id, orbitNumber]))
    const sectorEdges = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}:${toNodeId}`))

    for (let firstSectorIndex = 0; firstSectorIndex < system.sectors.length; firstSectorIndex++) {
      for (let secondSectorIndex = firstSectorIndex + 1; secondSectorIndex < system.sectors.length; secondSectorIndex++) {
        const firstSector = system.sectors[firstSectorIndex]
        const secondSector = system.sectors[secondSectorIndex]
        if (firstSector === undefined || secondSector === undefined) {
          continue
        }

        const firstOrbitNumber = orbitNumbersById.get(firstSector.orbitId)
        const secondOrbitNumber = orbitNumbersById.get(secondSector.orbitId)
        const orbitDistance =
          firstOrbitNumber === undefined || secondOrbitNumber === undefined
            ? Number.POSITIVE_INFINITY
            : Math.abs(firstOrbitNumber - secondOrbitNumber)
        const sharesBorder =
          orbitDistance === 0
            ? firstSector.angleRange.max === secondSector.angleRange.min ||
              secondSector.angleRange.max === firstSector.angleRange.min ||
              (firstSector.angleRange.min === 0 && secondSector.angleRange.max === 360) ||
              (secondSector.angleRange.min === 0 && firstSector.angleRange.max === 360)
            : orbitDistance === 1 && Range.overlaps(firstSector.angleRange, secondSector.angleRange)

        expect(sectorEdges.has(`${firstSector.movementNodeId}:${secondSector.movementNodeId}`)).toBe(sharesBorder)
      }
    }
  })

  it("should fail settings that cannot fit within the orbit limit", () => {
    const result = generateStarSystem(
      createStarSystemGenerationSettingsStub({
        planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0, max: 0 }),
        nbPlanets: Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 1, max: 1 }),
      }),
    )

    expect(result).toEqual(Result.Failure(expect.stringContaining("6 orbit limit")))
  })
})

function getBodyLocations(system: NewStarSystemModel, bodyType: BodyType): string[] {
  const sectorsById = new Map(system.sectors.map((sector) => [sector.id, sector]))
  const orbitsById = new Map(system.orbits.map((orbit) => [orbit.id, orbit]))

  return system.bodies
    .filter((body) => body.bodyType === bodyType)
    .map((body) => {
      const sector = sectorsById.get(body.sectorId)
      const orbit = sector === undefined ? undefined : orbitsById.get(sector.orbitId)
      return `${orbit?.orbitNumber}:${sector?.sectorNumber}`
    })
    .sort()
}
