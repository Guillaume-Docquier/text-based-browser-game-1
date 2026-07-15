import { Assert, Range, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { MAX_ORBIT_COUNT } from "#api/gameplay/star-systems/StarSystemGenerationSettingsLimits.ts"
import type { NewMovementEdgeModel } from "#api/gameplay/star-systems/StarSystemModels.ts"
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
      ...system.sectors.map((sector) => sector.id),
      ...system.bodies.map((body) => body.id),
    ]
    const uniqueIds = Array.from(new Set(ids))
    expect(ids).toEqual(uniqueIds)
  })

  it("should generate orbits without gaps", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: MAX_ORBIT_COUNT - 1, max: MAX_ORBIT_COUNT - 1 }),
      seed: 4,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const orbitNumbers = system.orbits.map((orbit) => orbit.orbitNumber)
    expect(orbitNumbers).toEqual(Array.from({ length: MAX_ORBIT_COUNT }, (_, i) => i + 1))
  })

  it("should generate equally wide sectors in each orbit", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      planetDensity: Range.float({ min: 0.99, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: MAX_ORBIT_COUNT - 1, max: MAX_ORBIT_COUNT - 1 }),
      seed: 5,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    Assert.isTrue(system.orbits.length === MAX_ORBIT_COUNT)
    const sectorsByOrbitId = Map.groupBy(system.sectors, (sector) => sector.orbitId)
    for (const orbit of system.orbits) {
      const sectors = sectorsByOrbitId.get(orbit.id)
      Assert.isDefined(sectors)
      const sectorWidths = new Set(sectors.map((sector) => sector.angleRange.max - sector.angleRange.min))
      expect.soft(sectorWidths).toEqual(new Set([360 / sectors.length]))
    }
  })

  it("should end each orbit's final sector at 360 degrees", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 1, max: 1 }),
      planetDensity: Range.float({ min: 0.99, max: 1 }),
      nbAsteroidBelts: Range.integer({ min: MAX_ORBIT_COUNT - 1, max: MAX_ORBIT_COUNT - 1 }),
      seed: 5,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    Assert.isTrue(system.orbits.length === MAX_ORBIT_COUNT)
    const sectorsByOrbitId = Map.groupBy(system.sectors, (sector) => sector.orbitId)
    for (const orbit of system.orbits) {
      const sectors = sectorsByOrbitId.get(orbit.id)
      Assert.isDefined(sectors)
      const finalSector = sectors.at(-1)
      Assert.isDefined(finalSector)
      expect.soft(finalSector.angleRange.max).toBe(360)
    }
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

  it("should contain only valid movement target ids", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({ seed: 1 })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const movementTargetIds = new Set([...system.sectors.map((sector) => sector.id), ...system.bodies.map((body) => body.id)])
    const movementEdgesTargetIds = new Set(
      system.movementEdges.flatMap((movementEdge) => [movementEdge.fromTargetId, movementEdge.toTargetId]),
    )

    expect(movementEdgesTargetIds).toEqual(movementTargetIds)
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
      seed: 16,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    // We'll map movement target ids to coordinates to make it easier to debug
    const coordinatesByMovementTargetId = new Map<string, string>()
    for (const orbit of system.orbits) {
      for (const sector of system.sectors.filter((s) => s.orbitId === orbit.id)) {
        coordinatesByMovementTargetId.set(sector.id, toCoordinates({ orbitNumber: orbit.orbitNumber, sectorNumber: sector.sectorNumber }))

        for (const body of system.bodies.filter((b) => b.sectorId === sector.id)) {
          coordinatesByMovementTargetId.set(
            body.id,
            toCoordinates({ orbitNumber: orbit.orbitNumber, sectorNumber: sector.sectorNumber, bodyNumber: body.bodyNumber }),
          )
        }
      }
    }

    function getCoordinates(movementTargetId: string): string {
      const coordinates = coordinatesByMovementTargetId.get(movementTargetId)
      Assert.isDefined(coordinates)
      return coordinates
    }

    function compareMovementEdges(firstEdge: NewMovementEdgeModel, secondEdge: NewMovementEdgeModel): number {
      const firstComparison = firstEdge.fromTargetId.localeCompare(secondEdge.fromTargetId)
      if (firstComparison !== 0) {
        return firstComparison
      }

      return firstEdge.toTargetId.localeCompare(secondEdge.toTargetId)
    }

    const movementEdgesByCoordinates = system.movementEdges
      .map(({ fromTargetId, toTargetId }) => generateMovementEdge(getCoordinates(fromTargetId), getCoordinates(toTargetId)))
      // oxlint-disable-next-line unicorn/no-array-sort -- We're already working off of a copy, we don't need another one
      .sort(compareMovementEdges)

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

    expect(movementEdgesByCoordinates).toEqual(
      [
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
        // oxlint-disable-next-line unicorn/no-array-sort -- We're working on a controlled copy, we don't need another one
      ].sort(compareMovementEdges),
    )
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
