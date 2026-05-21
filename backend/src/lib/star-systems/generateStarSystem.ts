import type {
  Orbit,
  Body,
  NewStarSystem,
  Sector,
  StarSystemGenerationSettings,
  MovementEdge,
} from "#lib/db/star-systems/starSystems.repository.ts"
import { mulberry32Prng } from "../rng/mulberry32prng.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createRng, type Rng } from "#lib/rng/rng.ts"
import { Result } from "@guillaume-docquier/tools-ts"
import type { StarSystemGenerationSettingsDto } from "#api/games/games.controller.ts"
import type { IntegerRange, PercentageRange } from "#lib/Range.ts"

const MAX_ORBITS = 6

const FIRST_ORBIT_SECTOR_COUNT = 2
const MOVEMENT_EDGE_WEIGHT = 1

type GeneratedOrbit = Orbit & {
  isAsteroidBelt: boolean
  sectorCount: number
}

type GeneratedSector = Sector & {
  orbitNumber: number
  isAsteroidBelt: boolean
}

export function generateStarSystem(settings: Readonly<StarSystemGenerationSettings>): Omit<NewStarSystem, "gameId"> {
  const rng = createRng(mulberry32Prng(settings.seed))
  const planetDensity = rng.float(settings.planetDensity)
  const nbPlanets = rng.int(settings.nbPlanets)
  const nbAsteroidBelts = rng.int(settings.nbAsteroidBelts)
  const orbits = generateOrbits({ nbPlanets, nbAsteroidBelts, planetDensity, rng })
  const sectors = generateSectors({ orbits, rng })
  const bodies = generateBodies({ sectors, nbPlanets, settings, rng })
  const movementNodes = [
    ...sectors.map((sector) => ({ id: sector.movementNodeId })),
    ...bodies.map((body) => ({ id: body.movementNodeId })),
  ]
  const movementEdges = generateMovementEdges({ orbits, sectors, bodies })

  return {
    starSystemGenerationSettings: settings,
    orbits: orbits.map(({ isAsteroidBelt: _isAsteroidBelt, sectorCount: _sectorCount, ...orbit }) => orbit),
    sectors: sectors.map(({ orbitNumber: _orbitNumber, isAsteroidBelt: _isAsteroidBelt, ...sector }) => sector),
    bodies,
    movementNodes,
    movementEdges,
  }
}

function generateOrbits({
  nbPlanets,
  nbAsteroidBelts,
  planetDensity,
  rng,
}: {
  nbPlanets: number
  nbAsteroidBelts: number
  planetDensity: number
  rng: Rng
}): GeneratedOrbit[] {
  const orbits: GeneratedOrbit[] = []
  let remainingAsteroidBelts = nbAsteroidBelts

  for (let orbitNumber = 1; orbitNumber <= MAX_ORBITS; orbitNumber++) {
    const remainingOrbitSlots = MAX_ORBITS - orbitNumber + 1
    const sectorCount = getSectorCountForOrbit(orbitNumber)
    const mustPlaceAsteroidBelt = remainingAsteroidBelts === remainingOrbitSlots
    const isAsteroidBelt =
      remainingAsteroidBelts > 0 && (mustPlaceAsteroidBelt || rng.float() < remainingAsteroidBelts / remainingOrbitSlots)

    if (isAsteroidBelt) {
      remainingAsteroidBelts--
    }

    orbits.push({
      id: randomUuid(rng),
      orbitNumber,
      sectorCount,
      isAsteroidBelt,
    })

    const nonBeltSectorCount = orbits
      .filter((orbit) => !orbit.isAsteroidBelt)
      .reduce((totalSectorCount, orbit) => totalSectorCount + orbit.sectorCount, 0)
    const planetCapacity = Math.floor(nonBeltSectorCount * planetDensity)

    if (remainingAsteroidBelts === 0 && planetCapacity >= nbPlanets) {
      return orbits
    }
  }

  throw new Error(`Could not generate Star System within ${MAX_ORBITS} orbits`)
}

function generateSectors({ orbits, rng }: { orbits: GeneratedOrbit[]; rng: Rng }): GeneratedSector[] {
  return orbits.flatMap((orbit) =>
    Array.from({ length: orbit.sectorCount }, (_, index) => ({
      id: randomUuid(rng),
      orbitId: orbit.id,
      orbitNumber: orbit.orbitNumber,
      isAsteroidBelt: orbit.isAsteroidBelt,
      sectorNumber: index + 1,
      movementNodeId: randomUuid(rng),
    })),
  )
}

function generateBodies({
  sectors,
  nbPlanets,
  settings,
  rng,
}: {
  sectors: GeneratedSector[]
  nbPlanets: number
  settings: StarSystemGenerationSettings
  rng: Rng
}): Body[] {
  const bodies: Body[] = []
  const sectorsById = new Map(sectors.map((sector) => [sector.id, sector]))
  const asteroidBeltSectors = sectors.filter((sector) => sector.isAsteroidBelt)

  for (const sector of asteroidBeltSectors) {
    const nbAsteroids = rng.int(settings.nbAsteroidsPerSector)
    for (let asteroidIndex = 0; asteroidIndex < nbAsteroids; asteroidIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: asteroidIndex + 1, bodyType: BodyType.ASTEROID, rng }))
    }
  }

  const asteroidBeltSectorIds = new Set(asteroidBeltSectors.map((sector) => sector.id))
  const planetSectors = rng.shuffle(sectors.filter((sector) => !asteroidBeltSectorIds.has(sector.id))).slice(0, nbPlanets)

  for (const sector of planetSectors) {
    bodies.push(createBody({ sectorId: sector.id, bodyNumber: 1, bodyType: BodyType.PLANET, rng }))

    const nbMoons = rng.int(settings.nbMoonsPerPlanet)
    for (let moonIndex = 0; moonIndex < nbMoons; moonIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: moonIndex + 2, bodyType: BodyType.MOON, rng }))
    }
  }

  return bodies.sort((bodyA, bodyB) => {
    const sectorA = sectorsById.get(bodyA.sectorId)
    const sectorB = sectorsById.get(bodyB.sectorId)
    if (sectorA === undefined || sectorB === undefined) {
      throw new Error("Body references an unknown Sector")
    }

    const orbitSort = sectorA.orbitNumber - sectorB.orbitNumber
    if (orbitSort !== 0) {
      return orbitSort
    }

    const sectorSort = sectorA.sectorNumber - sectorB.sectorNumber
    if (sectorSort !== 0) {
      return sectorSort
    }

    return bodyA.bodyNumber - bodyB.bodyNumber
  })
}

function createBody({ sectorId, bodyNumber, bodyType, rng }: { sectorId: string; bodyNumber: number; bodyType: BodyType; rng: Rng }): Body {
  return {
    id: randomUuid(rng),
    sectorId,
    bodyNumber,
    bodyType,
    name: `${toTitleCase(bodyType)} ${bodyNumber.toString().padStart(2, "0")}`,
    movementNodeId: randomUuid(rng),
  }
}

function generateMovementEdges({
  orbits,
  sectors,
  bodies,
}: {
  orbits: GeneratedOrbit[]
  sectors: GeneratedSector[]
  bodies: Body[]
}): MovementEdge[] {
  const edges = new Map<string, MovementEdge>()
  const sectorsByOrbitId = Map.groupBy(sectors, ({ orbitId }) => orbitId)
  const bodiesBySectorId = Map.groupBy(bodies, ({ sectorId }) => sectorId)

  for (const sector of sectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []

    for (const body of sectorBodies) {
      addUndirectedEdge(edges, sector.movementNodeId, body.movementNodeId)
    }

    for (let fromIndex = 0; fromIndex < sectorBodies.length; fromIndex++) {
      for (let toIndex = fromIndex + 1; toIndex < sectorBodies.length; toIndex++) {
        const fromBody = sectorBodies[fromIndex]
        const toBody = sectorBodies[toIndex]
        if (fromBody === undefined || toBody === undefined) {
          throw new Error("Could not build same-sector Body edge")
        }
        addUndirectedEdge(edges, fromBody.movementNodeId, toBody.movementNodeId)
      }
    }
  }

  for (const orbit of orbits) {
    const orbitSectors = (sectorsByOrbitId.get(orbit.id) ?? []).toSorted((sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber)
    for (let index = 0; index < orbitSectors.length; index++) {
      const fromSector = orbitSectors[index]
      const toSector = orbitSectors[(index + 1) % orbitSectors.length]
      if (fromSector === undefined || toSector === undefined || fromSector.id === toSector.id) {
        continue
      }
      addUndirectedEdge(edges, fromSector.movementNodeId, toSector.movementNodeId)
    }
  }

  for (let orbitIndex = 0; orbitIndex < orbits.length - 1; orbitIndex++) {
    const innerOrbit = orbits[orbitIndex]
    const outerOrbit = orbits[orbitIndex + 1]
    if (innerOrbit === undefined || outerOrbit === undefined) {
      throw new Error("Could not build radial Sector edge")
    }

    const innerSectors = (sectorsByOrbitId.get(innerOrbit.id) ?? []).toSorted(
      (sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber,
    )
    const outerSectors = (sectorsByOrbitId.get(outerOrbit.id) ?? []).toSorted(
      (sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber,
    )

    for (const innerSector of innerSectors) {
      const firstOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2]
      const secondOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2 + 1]
      if (firstOuterSector === undefined || secondOuterSector === undefined) {
        throw new Error("Outer Orbit does not have double the inner Orbit Sector count")
      }

      addUndirectedEdge(edges, innerSector.movementNodeId, firstOuterSector.movementNodeId)
      addUndirectedEdge(edges, innerSector.movementNodeId, secondOuterSector.movementNodeId)
    }
  }

  return [...edges.values()]
}

function addUndirectedEdge(edges: Map<string, MovementEdge>, fromNodeId: string, toNodeId: string): void {
  addDirectedEdge(edges, fromNodeId, toNodeId)
  addDirectedEdge(edges, toNodeId, fromNodeId)
}

function addDirectedEdge(edges: Map<string, MovementEdge>, fromNodeId: string, toNodeId: string): void {
  edges.set(`${fromNodeId}->${toNodeId}`, { fromNodeId, toNodeId, weight: MOVEMENT_EDGE_WEIGHT })
}

function getSectorCountForOrbit(orbitNumber: number): number {
  return FIRST_ORBIT_SECTOR_COUNT * 2 ** (orbitNumber - 1)
}

function randomUuid(rng: Rng): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rng.float() * 256))
  const versionByte = bytes[6]
  const variantByte = bytes[8]
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("Could not generate deterministic UUID")
  }
  bytes[6] = (versionByte & 0x0f) | 0x40
  bytes[8] = (variantByte & 0x3f) | 0x80

  const hexBytes = bytes.map((byte) => byte.toString(16).padStart(2, "0"))

  return [
    hexBytes.slice(0, 4).join(""),
    hexBytes.slice(4, 6).join(""),
    hexBytes.slice(6, 8).join(""),
    hexBytes.slice(8, 10).join(""),
    hexBytes.slice(10, 16).join(""),
  ].join("-")
}

function toTitleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function validateStarSystemGenerationSettings(settings: Readonly<StarSystemGenerationSettingsDto>): Result<true, string> {
  const rangeChecks: Array<[string, PercentageRange | IntegerRange]> = [
    ["planetDensity", settings.planetDensity],
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ]

  for (const [rangeName, range] of rangeChecks) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      return Result.Failure(`${rangeName} must have finite bounds`)
    }

    if (range.min > range.max) {
      return Result.Failure(`${rangeName} min must be less than or equal to max`)
    }
  }

  if (settings.planetDensity.min < 0 || settings.planetDensity.max > 1) {
    return Result.Failure("planetDensity must stay between 0 and 1")
  }

  const integerRanges: Array<[string, IntegerRange]> = [
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ]

  for (const [rangeName, range] of integerRanges) {
    if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) {
      return Result.Failure(`${rangeName} must use integer bounds`)
    }

    if (range.min < 0) {
      return Result.Failure(`${rangeName} must be greater than or equal to 0`)
    }
  }

  if (settings.seed !== undefined && (!Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 2 ** 32 - 1)) {
    return Result.Failure("seed must be an unsigned 32-bit integer")
  }

  if (settings.nbAsteroidBelts.max > MAX_ORBITS) {
    return Result.Failure(`nbAsteroidBelts cannot be greater than ${MAX_ORBITS}`)
  }

  const maxNonBeltSectorCount = Array.from({ length: MAX_ORBITS }, (_, index) => 2 ** (index + 1))
    .toSorted((sectorCountA, sectorCountB) => sectorCountB - sectorCountA)
    .slice(0, MAX_ORBITS - settings.nbAsteroidBelts.max)
    .reduce((total, sectorCount) => total + sectorCount, 0)
  const maxPlanetCapacity = Math.floor(maxNonBeltSectorCount * settings.planetDensity.min)

  if (maxPlanetCapacity < settings.nbPlanets.max) {
    return Result.Failure(`settings cannot generate the requested Planets within ${MAX_ORBITS} orbits`)
  }

  return Result.Success(true)
}
