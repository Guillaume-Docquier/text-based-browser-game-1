import { Assert, Range, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { toCoordinates } from "./Coordinates.ts"
import { generateMovementEdge, generateStarSystem } from "./generateStarSystem.ts"

describe("generateStarSystem", () => {
  it("should generate identical Star Systems from identical settings", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ seed: 1 })

    // Act
    const firstSystem = extractSuccess(generateStarSystem({ settings, clock }))
    const secondSystem = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    expect(firstSystem).toEqual(secondSystem)
  })

  it("should generate different Star Systems with a real clock even if the settings are the same", () => {
    // Arrange
    const clock = Clock
    const settings = createStarSystemGenerationSettingsStub({ seed: 1 })

    // Act
    const firstSystem = extractSuccess(generateStarSystem({ settings, clock }))
    const secondSystem = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    expect(firstSystem).not.toEqual(secondSystem)
  })

  it("should generate different Star Systems from different settings", () => {
    // Arrange
    const clock = new ControlledClock()
    const firstSettings = createStarSystemGenerationSettingsStub({ seed: 1 })
    const secondSettings = createStarSystemGenerationSettingsStub({ seed: 2 })

    // Act
    const firstSystem = extractSuccess(generateStarSystem({ settings: firstSettings, clock }))
    const secondSystem = extractSuccess(generateStarSystem({ settings: secondSettings, clock }))

    // Assert
    expect(firstSystem).not.toEqual(secondSystem)
  })

  it("should generate unique ids", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ seed: 3 })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const ids = [
      ...system.orbits.map((orbit) => orbit.id),
      ...system.sectors.flatMap((sector) => [sector.id, sector.movementNodeId]),
      ...system.bodies.flatMap((body) => [body.id, body.movementNodeId]),
    ]
    const uniqueIds = Array.from(new Set(ids))
    expect(ids).toEqual(uniqueIds)
  })

  it("should generate orbits without gaps", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: 5, max: 5 }),
      seed: 4,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const orbitNumbers = system.orbits.map((orbit) => orbit.orbitNumber)
    expect(orbitNumbers).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("should allow the outermost orbit to be an asteroid belt", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      planetDensity: Range.float({ min: 0.99, max: 1 }),
      nbMoonsPerPlanet: Range.integer({ min: 1, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
      nbAsteroidsPerSector: Range.integer({ min: 1, max: 1 }),
      seed: 2381652680,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    expect(system.orbits).toHaveLength(2)
    Assert.isDefined(system.orbits[1])

    const asteroidBeltOrbitId = system.orbits[1].id
    const asteroidBeltSectorIds = new Set(
      system.sectors.filter((sector) => sector.orbitId === asteroidBeltOrbitId).map((sector) => sector.id),
    )
    expect(asteroidBeltSectorIds.size).toBeGreaterThan(0)

    const asteroidBeltBodies = system.bodies.filter((body) => asteroidBeltSectorIds.has(body.sectorId))
    expect(asteroidBeltBodies).toHaveLength(asteroidBeltSectorIds.size)

    const asteroidBeltBodiesTypes = new Set(asteroidBeltBodies.map((body) => body.bodyType))
    expect(asteroidBeltBodiesTypes).toEqual(new Set([BodyType.ASTEROID]))

    const allBodyTypes = new Set(system.bodies.map((body) => body.bodyType))
    expect(allBodyTypes).toEqual(new Set([BodyType.ASTEROID, BodyType.PLANET, BodyType.MOON]))
  })

  it("should not force the outermost orbit to be an asteroid belt", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      planetDensity: Range.float({ min: 0.99, max: 1 }),
      nbMoonsPerPlanet: Range.integer({ min: 1, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
      nbAsteroidsPerSector: Range.integer({ min: 1, max: 1 }),
      seed: 3132067520,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    expect(system.orbits).toHaveLength(2)
    Assert.isDefined(system.orbits[1])

    const normalOrbitId = system.orbits[1].id
    const normalSectorIds = new Set(system.sectors.filter((sector) => sector.orbitId === normalOrbitId).map((sector) => sector.id))
    expect(normalSectorIds.size).toBeGreaterThan(0)

    const normalBodies = system.bodies.filter((body) => normalSectorIds.has(body.sectorId))
    expect(normalBodies).toHaveLength(2)

    const normalBodyTypes = new Set(normalBodies.map((body) => body.bodyType))
    expect(normalBodyTypes).toEqual(new Set([BodyType.PLANET, BodyType.MOON]))

    const allBodyTypes = new Set(system.bodies.map((body) => body.bodyType))
    expect(allBodyTypes).toEqual(new Set([BodyType.ASTEROID, BodyType.PLANET, BodyType.MOON]))
  })

  it("should contain only valid movement node ids", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ seed: 1 })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const sectorBodiesMovementNodeIds = new Set([
      ...system.sectors.map((sector) => sector.movementNodeId),
      ...system.bodies.map((sector) => sector.movementNodeId),
    ])
    const movementNodeIds = new Set(system.movementNodes.map((movementNode) => movementNode.id))
    const movementEdgesMovementNodeIds = new Set(
      system.movementEdges.flatMap((movementEdge) => [movementEdge.fromNodeId, movementEdge.toNodeId]),
    )

    expect(sectorBodiesMovementNodeIds).toEqual(movementNodeIds)
    expect(movementEdgesMovementNodeIds).toEqual(movementNodeIds)
  })

  it("should connect bodies and sectors correctly", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      planetDensity: Range.float({ min: 0.99, max: 1 }),
      nbMoonsPerPlanet: Range.integer({ min: 1, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
      nbAsteroidsPerSector: Range.integer({ min: 1, max: 1 }),
      seed: 0,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const coordinatesByMovementNodeId = new Map<string, string>()
    for (const orbit of system.orbits) {
      for (const sector of system.sectors.filter((s) => s.orbitId === orbit.id)) {
        const sectorCoordinates = toCoordinates({ orbitNumber: orbit.orbitNumber, sectorNumber: sector.sectorNumber })
        coordinatesByMovementNodeId.set(sector.movementNodeId, sectorCoordinates)

        for (const body of system.bodies.filter((b) => b.sectorId === sector.id)) {
          const bodyCoordinates = toCoordinates({
            orbitNumber: orbit.orbitNumber,
            sectorNumber: sector.sectorNumber,
            bodyNumber: body.bodyNumber,
          })
          coordinatesByMovementNodeId.set(body.movementNodeId, bodyCoordinates)
        }
      }
    }

    function getCoordinates(movementNodeId: string): string {
      const coordinates = coordinatesByMovementNodeId.get(movementNodeId)
      Assert.isDefined(coordinates)
      return coordinates
    }

    const movementEdgesByCoordinates = system.movementEdges.map(({ fromNodeId, toNodeId }) => {
      return generateMovementEdge(getCoordinates(fromNodeId), getCoordinates(toNodeId))
    })

    const o1s1 = toCoordinates({ orbitNumber: 1, sectorNumber: 1 })

    const o1s2 = toCoordinates({ orbitNumber: 1, sectorNumber: 2 })
    const o1s2p1 = toCoordinates({ orbitNumber: 1, sectorNumber: 2, bodyNumber: 1 })
    const o1s2m2 = toCoordinates({ orbitNumber: 1, sectorNumber: 2, bodyNumber: 2 })

    const o2s1 = toCoordinates({ orbitNumber: 2, sectorNumber: 1 })
    const o2s1a1 = toCoordinates({ orbitNumber: 2, sectorNumber: 1, bodyNumber: 1 })

    const o2s2 = toCoordinates({ orbitNumber: 2, sectorNumber: 2 })
    const o2s2a1 = toCoordinates({ orbitNumber: 2, sectorNumber: 2, bodyNumber: 1 })

    const o2s3 = toCoordinates({ orbitNumber: 2, sectorNumber: 3 })
    const o2s3a1 = toCoordinates({ orbitNumber: 2, sectorNumber: 3, bodyNumber: 1 })

    const o2s4 = toCoordinates({ orbitNumber: 2, sectorNumber: 4 })
    const o2s4a1 = toCoordinates({ orbitNumber: 2, sectorNumber: 4, bodyNumber: 1 })

    expect(movementEdgesByCoordinates).toEqual([
      // o1s1
      generateMovementEdge(o1s1, o1s2),
      generateMovementEdge(o1s1, o2s1),
      generateMovementEdge(o1s1, o2s2),

      // o1s2
      generateMovementEdge(o1s2, o1s1),
      generateMovementEdge(o1s2, o2s3),
      generateMovementEdge(o1s2, o2s4),
      generateMovementEdge(o1s2, o1s2p1),
      generateMovementEdge(o1s2, o1s2m2),

      // o1s2b1
      generateMovementEdge(o1s2p1, o1s2),
      generateMovementEdge(o1s2p1, o1s2m2),

      // o1s2b2
      generateMovementEdge(o1s2m2, o1s2),
      generateMovementEdge(o1s2m2, o1s2p1),

      // o2s1
      generateMovementEdge(o2s1, o1s1),
      generateMovementEdge(o2s1, o2s4),
      generateMovementEdge(o2s1, o2s2),
      generateMovementEdge(o2s1, o2s1a1),

      // o2s1b1
      generateMovementEdge(o2s1a1, o2s1),

      // o2s2
      generateMovementEdge(o2s2, o1s1),
      generateMovementEdge(o2s2, o2s1),
      generateMovementEdge(o2s2, o2s3),
      generateMovementEdge(o2s2, o2s2a1),

      // o2s2b1
      generateMovementEdge(o2s2a1, o2s2),

      // o2s3
      generateMovementEdge(o2s3, o1s2),
      generateMovementEdge(o2s3, o2s2),
      generateMovementEdge(o2s3, o2s4),
      generateMovementEdge(o2s3, o2s3a1),

      // o2s3b1
      generateMovementEdge(o2s3a1, o2s3),

      // o2s4
      generateMovementEdge(o2s4, o1s2),
      generateMovementEdge(o2s4, o2s3),
      generateMovementEdge(o2s4, o2s1),
      generateMovementEdge(o2s4, o2s4a1),

      // o2s4b1
      generateMovementEdge(o2s4a1, o2s4),
    ])
  })

  it("[to review] should create reciprocal movement edges and one node per Sector and Body", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub()

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const edges = new Set(system.movementEdges.map(({ fromNodeId, toNodeId }) => `${fromNodeId}:${toNodeId}`))

    expect(system.movementNodes).toHaveLength(system.sectors.length + system.bodies.length)
    for (const edge of system.movementEdges) {
      expect(edges.has(`${edge.toNodeId}:${edge.fromNodeId}`)).toBe(true)
    }
  })

  it("[to review] should connect Sectors when their angle ranges share a border", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: Range.float({ min: 0.2, max: 0.3 }),
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      nbMoonsPerPlanet: Range.integer({ min: 0, max: 0 }),
      nbAsteroidBelts: Range.integer({ min: 0, max: 0 }),
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
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

  it.each([Range.float({ min: -0.1, max: 0.5 }), Range.float({ min: 0.5, max: 1.1 })])(
    "should fail with planet density outside [0, 1] (%s)",
    (planetDensity) => {
      // Arrange
      const clock = new ControlledClock()
      const settings = createStarSystemGenerationSettingsStub({ planetDensity })

      // Act
      const systemResult = generateStarSystem({ settings, clock })

      // Assert
      expect(systemResult).toEqual(Result.Failure(expect.any(String)))
    },
  )

  it("should fail when settings are negative", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ nbAsteroidBelts: Range.integer({ min: -1, max: 1 }) })

    // Act
    const systemResult = generateStarSystem({ settings, clock })

    // Assert
    expect(systemResult).toEqual(Result.Failure(expect.any(String)))
  })

  it("should fail when settings result in too many orbits", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ nbAsteroidBelts: Range.integer({ min: 10, max: 10 }) })

    // Act
    const systemResult = generateStarSystem({ settings, clock })

    // Assert
    expect(systemResult).toEqual(Result.Failure(expect.any(String)))
  })
})
