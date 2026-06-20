import { Range, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { generateStarSystem } from "./generateStarSystem.ts"

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

  it("[to review] should generate exact body counts and one complete Asteroid belt", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      nbPlanets: Range.integer({ min: 5, max: 5 }),
      nbMoonsPerPlanet: Range.integer({ min: 2, max: 2 }),
      nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
      nbAsteroidsPerSector: Range.integer({ min: 2, max: 2 }),
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
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

  it("[to review] should allow the outermost Orbit to be an Asteroid belt", () => {
    // Arrange
    const clock = new ControlledClock()
    const settings = createStarSystemGenerationSettingsStub({
      planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 1, max: 1 }),
      nbPlanets: Range.integer({ min: 2, max: 2 }),
      nbMoonsPerPlanet: Range.integer({ min: 0, max: 0 }),
      nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
      nbAsteroidsPerSector: Range.integer({ min: 1, max: 1 }),
      seed: 0,
    })

    // Act
    const system = extractSuccess(generateStarSystem({ settings, clock }))

    // Assert
    const outerOrbit = system.orbits.at(-1)
    const outerSectorIds = new Set(system.sectors.filter(({ orbitId }) => orbitId === outerOrbit?.id).map(({ id }) => id))

    expect(
      system.bodies.filter(({ sectorId }) => outerSectorIds.has(sectorId)).every(({ bodyType }) => bodyType === BodyType.ASTEROID),
    ).toBe(true)
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
