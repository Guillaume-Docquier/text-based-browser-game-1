import { createRng, mulberry32Prng, Range, Result, type Rng } from "@guillaume-docquier/tools-ts"
import { v7 } from "uuid"
import type { NewStarSystemModel } from "#api/gameplay/gameplay.repository.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { StarSystemGenerationSettings } from "#api/star-systems/StarSystemGenerationSettings.ts"
import { BodyType } from "./BodyType.ts"

const MAX_ORBITS = 6
const FIRST_ORBIT_SECTOR_COUNT = 2
const UUID_RANDOM_BYTE_COUNT = 16

type GeneratedOrbit = {
  orbitNumber: number
  sectorCount: number
  isAsteroidBelt: boolean
}

type GeneratedSector = NewStarSystemModel["sectors"][number] & {
  orbitNumber: number
  isAsteroidBelt: boolean
}

export function generateStarSystem({
  gameId,
  settings,
}: {
  gameId: GameId
  settings: StarSystemGenerationSettings
}): Result<NewStarSystemModel, string> {
  const invalidSettingsReason = validateSettings(settings)
  if (invalidSettingsReason !== undefined) {
    return Result.Failure(invalidSettingsReason)
  }

  const rng = createRng(mulberry32Prng(settings.seed))
  const planetDensity = rng.random(settings.planetDensity)
  const nbPlanets = rng.random(settings.nbPlanets)
  const nbAsteroidBelts = rng.random(settings.nbAsteroidBelts)

  const candidateOrbitsResult = generateCandidateOrbits({ planetDensity, nbPlanets, nbAsteroidBelts })
  if (Result.isFailure(candidateOrbitsResult)) {
    return candidateOrbitsResult
  }

  const beltOrbitNumbers = new Set(
    rng.draw(
      candidateOrbitsResult.value.map(({ orbitNumber }) => orbitNumber),
      nbAsteroidBelts,
    ).drawn,
  )
  const orbits = trimOuterOrbits({
    orbits: candidateOrbitsResult.value.map((orbit) => ({
      ...orbit,
      isAsteroidBelt: beltOrbitNumbers.has(orbit.orbitNumber),
    })),
    planetDensity,
    nbPlanets,
  })

  const createId = createDeterministicUuidFactory({ rng, seed: settings.seed })
  const orbitModels: NewStarSystemModel["orbits"] = []
  const sectors: GeneratedSector[] = []

  for (const orbit of orbits) {
    const orbitId = createId()
    orbitModels.push({ id: orbitId, orbitNumber: orbit.orbitNumber })

    const sectorAngle = 360 / orbit.sectorCount
    for (let sectorNumber = 1; sectorNumber <= orbit.sectorCount; sectorNumber++) {
      sectors.push({
        id: createId(),
        orbitId,
        orbitNumber: orbit.orbitNumber,
        sectorNumber,
        angleRange: Range.create({
          numericType: "float",
          maxBoundType: "exclusive",
          min: (sectorNumber - 1) * sectorAngle,
          max: sectorNumber * sectorAngle,
        }),
        movementNodeId: createId(),
        isAsteroidBelt: orbit.isAsteroidBelt,
      })
    }
  }

  const bodies: NewStarSystemModel["bodies"] = []
  const planetSectors = rng.draw(
    sectors.filter(({ isAsteroidBelt }) => !isAsteroidBelt),
    nbPlanets,
  ).drawn

  let planetNumber = 0
  let moonNumber = 0
  let asteroidNumber = 0

  for (const sector of sectors) {
    if (sector.isAsteroidBelt) {
      const nbAsteroids = rng.random(settings.nbAsteroidsPerSector)
      for (let bodyNumber = 1; bodyNumber <= nbAsteroids; bodyNumber++) {
        asteroidNumber++
        bodies.push({
          id: createId(),
          sectorId: sector.id,
          bodyNumber,
          bodyType: BodyType.ASTEROID,
          name: `Asteroid ${asteroidNumber}`,
          movementNodeId: createId(),
        })
      }
      continue
    }

    if (!planetSectors.includes(sector)) {
      continue
    }

    planetNumber++
    bodies.push({
      id: createId(),
      sectorId: sector.id,
      bodyNumber: 1,
      bodyType: BodyType.PLANET,
      name: `Planet ${planetNumber}`,
      movementNodeId: createId(),
    })

    const nbMoons = rng.random(settings.nbMoonsPerPlanet)
    for (let bodyNumber = 2; bodyNumber <= nbMoons + 1; bodyNumber++) {
      moonNumber++
      bodies.push({
        id: createId(),
        sectorId: sector.id,
        bodyNumber,
        bodyType: BodyType.MOON,
        name: `Moon ${moonNumber}`,
        movementNodeId: createId(),
      })
    }
  }

  const storedSectors: NewStarSystemModel["sectors"] = sectors.map(
    ({ orbitNumber: _orbitNumber, isAsteroidBelt: _isAsteroidBelt, ...sector }) => sector,
  )
  const movementNodes = [
    ...sectors.map(({ movementNodeId }) => ({ id: movementNodeId })),
    ...bodies.map(({ movementNodeId }) => ({ id: movementNodeId })),
  ]
  const movementEdges = createMovementEdges({ sectors, bodies })

  return Result.Success({
    gameId,
    orbits: orbitModels,
    sectors: storedSectors,
    bodies,
    movementNodes,
    movementEdges,
  })
}

function validateSettings(settings: StarSystemGenerationSettings): string | undefined {
  if (settings.planetDensity.numericType !== "float" || settings.planetDensity.min < 0 || settings.planetDensity.max > 1) {
    return "Planet density must be a float range between 0 and 1."
  }

  const integerRanges = [settings.nbPlanets, settings.nbMoonsPerPlanet, settings.nbAsteroidBelts, settings.nbAsteroidsPerSector]
  if (integerRanges.some((range) => range.numericType !== "integer" || range.min < 0)) {
    return "Star System count settings must be non-negative integer ranges."
  }

  return undefined
}

function generateCandidateOrbits({
  planetDensity,
  nbPlanets,
  nbAsteroidBelts,
}: {
  planetDensity: number
  nbPlanets: number
  nbAsteroidBelts: number
}): Result<Array<Omit<GeneratedOrbit, "isAsteroidBelt">>, string> {
  const orbits: Array<Omit<GeneratedOrbit, "isAsteroidBelt">> = []

  while (orbits.length < MAX_ORBITS) {
    const orbitNumber = orbits.length + 1
    orbits.push({
      orbitNumber,
      sectorCount: FIRST_ORBIT_SECTOR_COUNT * 2 ** (orbitNumber - 1),
    })

    if (orbits.length < Math.max(1, nbAsteroidBelts)) {
      continue
    }

    const worstCaseNonBeltSectorCount = orbits
      .slice(0, orbits.length - nbAsteroidBelts)
      .reduce((sectorCount, orbit) => sectorCount + orbit.sectorCount, 0)
    if (Math.floor(worstCaseNonBeltSectorCount * planetDensity) >= nbPlanets) {
      return Result.Success(orbits)
    }
  }

  return Result.Failure(`Star System settings cannot be generated within the ${MAX_ORBITS} orbit limit.`)
}

function trimOuterOrbits({
  orbits,
  planetDensity,
  nbPlanets,
}: {
  orbits: GeneratedOrbit[]
  planetDensity: number
  nbPlanets: number
}): GeneratedOrbit[] {
  while (orbits.length > 1) {
    const outerOrbit = orbits.at(-1)
    if (outerOrbit?.isAsteroidBelt !== false) {
      break
    }

    const remainingOrbits = orbits.slice(0, -1)
    const nonBeltSectorCount = remainingOrbits
      .filter(({ isAsteroidBelt }) => !isAsteroidBelt)
      .reduce((sectorCount, orbit) => sectorCount + orbit.sectorCount, 0)
    if (Math.floor(nonBeltSectorCount * planetDensity) < nbPlanets) {
      break
    }

    orbits.pop()
  }

  return orbits
}

function createDeterministicUuidFactory({ rng, seed }: { rng: Rng; seed: number }): () => string {
  let sequence = 0
  const baseTimestamp = seed >>> 0

  return () => {
    const random = Uint8Array.from({ length: UUID_RANDOM_BYTE_COUNT }, () =>
      rng.int(Range.create({ numericType: "integer", maxBoundType: "inclusive", min: 0, max: 255 })),
    )
    const id = v7({
      random,
      msecs: baseTimestamp + sequence,
      seq: sequence,
    })
    sequence++
    return id
  }
}

function createMovementEdges({
  sectors,
  bodies,
}: {
  sectors: GeneratedSector[]
  bodies: NewStarSystemModel["bodies"]
}): NewStarSystemModel["movementEdges"] {
  const movementEdges = new Map<string, NewStarSystemModel["movementEdges"][number]>()
  const bodiesBySectorId = Map.groupBy(bodies, ({ sectorId }) => sectorId)

  const connect = (firstNodeId: string, secondNodeId: string): void => {
    movementEdges.set(`${firstNodeId}:${secondNodeId}`, { fromNodeId: firstNodeId, toNodeId: secondNodeId, weight: 1 })
    movementEdges.set(`${secondNodeId}:${firstNodeId}`, { fromNodeId: secondNodeId, toNodeId: firstNodeId, weight: 1 })
  }

  for (const sector of sectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []
    for (const body of sectorBodies) {
      connect(sector.movementNodeId, body.movementNodeId)
    }

    for (let firstBodyIndex = 0; firstBodyIndex < sectorBodies.length; firstBodyIndex++) {
      for (let secondBodyIndex = firstBodyIndex + 1; secondBodyIndex < sectorBodies.length; secondBodyIndex++) {
        const firstBody = sectorBodies[firstBodyIndex]
        const secondBody = sectorBodies[secondBodyIndex]
        if (firstBody !== undefined && secondBody !== undefined) {
          connect(firstBody.movementNodeId, secondBody.movementNodeId)
        }
      }
    }
  }

  for (let firstSectorIndex = 0; firstSectorIndex < sectors.length; firstSectorIndex++) {
    for (let secondSectorIndex = firstSectorIndex + 1; secondSectorIndex < sectors.length; secondSectorIndex++) {
      const firstSector = sectors[firstSectorIndex]
      const secondSector = sectors[secondSectorIndex]
      if (firstSector === undefined || secondSector === undefined || !areSectorsAdjacent(firstSector, secondSector)) {
        continue
      }

      connect(firstSector.movementNodeId, secondSector.movementNodeId)
    }
  }

  return [...movementEdges.values()]
}

function areSectorsAdjacent(firstSector: GeneratedSector, secondSector: GeneratedSector): boolean {
  const orbitDistance = Math.abs(firstSector.orbitNumber - secondSector.orbitNumber)
  if (orbitDistance > 1) {
    return false
  }

  if (orbitDistance === 1) {
    return Range.overlaps(firstSector.angleRange, secondSector.angleRange)
  }

  return (
    firstSector.angleRange.max === secondSector.angleRange.min ||
    secondSector.angleRange.max === firstSector.angleRange.min ||
    (firstSector.angleRange.min === 0 && secondSector.angleRange.max === 360) ||
    (secondSector.angleRange.min === 0 && firstSector.angleRange.max === 360)
  )
}
