import type { IntegerRange, PercentageRange } from "#lib/Range.ts"
import type { NewStarSystem, StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"
import { mulberry32prng, type Prng } from "#lib/mulberry32prng.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"

export const MAX_ORBITS = 6

const FIRST_ORBIT_SECTOR_COUNT = 2
const MOVEMENT_EDGE_WEIGHT = 1

type GeneratedOrbit = NewStarSystem["orbits"][number] & {
  isAsteroidBelt: boolean
  sectorCount: number
}

type GeneratedSector = NewStarSystem["sectors"][number] & {
  orbitNumber: number
  isAsteroidBelt: boolean
}

export function generateStarSystem(settings: StarSystemGenerationSettings): Omit<NewStarSystem, "gameId"> {
  const prng = mulberry32prng(settings.seed)
  const planetDensity = rollPercentageRange(settings.planetDensity, prng)
  const nbPlanets = rollIntegerRange(settings.nbPlanets, prng)
  const nbAsteroidBelts = rollIntegerRange(settings.nbAsteroidBelts, prng)
  const orbits = generateOrbits({ nbPlanets, nbAsteroidBelts, planetDensity, prng })
  const sectors = generateSectors({ orbits, prng })
  const bodies = generateBodies({ sectors, nbPlanets, settings, prng })
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
  prng,
}: {
  nbPlanets: number
  nbAsteroidBelts: number
  planetDensity: number
  prng: Prng
}): GeneratedOrbit[] {
  const orbits: GeneratedOrbit[] = []
  let remainingAsteroidBelts = nbAsteroidBelts

  for (let orbitNumber = 1; orbitNumber <= MAX_ORBITS; orbitNumber++) {
    const remainingOrbitSlots = MAX_ORBITS - orbitNumber + 1
    const sectorCount = getSectorCountForOrbit(orbitNumber)
    const mustPlaceAsteroidBelt = remainingAsteroidBelts === remainingOrbitSlots
    const isAsteroidBelt = remainingAsteroidBelts > 0 && (mustPlaceAsteroidBelt || prng() < remainingAsteroidBelts / remainingOrbitSlots)

    if (isAsteroidBelt) {
      remainingAsteroidBelts--
    }

    orbits.push({
      id: randomUuid(prng),
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

function generateSectors({ orbits, prng }: { orbits: GeneratedOrbit[]; prng: Prng }): GeneratedSector[] {
  return orbits.flatMap((orbit) =>
    Array.from({ length: orbit.sectorCount }, (_, index) => ({
      id: randomUuid(prng),
      orbitId: orbit.id,
      orbitNumber: orbit.orbitNumber,
      isAsteroidBelt: orbit.isAsteroidBelt,
      sectorNumber: index + 1,
      movementNodeId: randomUuid(prng),
    })),
  )
}

function generateBodies({
  sectors,
  nbPlanets,
  settings,
  prng,
}: {
  sectors: GeneratedSector[]
  nbPlanets: number
  settings: StarSystemGenerationSettings
  prng: Prng
}): NewStarSystem["bodies"] {
  const bodies: NewStarSystem["bodies"] = []
  const sectorsById = new Map(sectors.map((sector) => [sector.id, sector]))
  const asteroidBeltSectors = sectors.filter((sector) => sector.isAsteroidBelt)

  for (const sector of asteroidBeltSectors) {
    const nbAsteroids = rollIntegerRange(settings.nbAsteroidsPerSector, prng)
    for (let asteroidIndex = 0; asteroidIndex < nbAsteroids; asteroidIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: asteroidIndex + 1, bodyType: BodyType.ASTEROID, prng }))
    }
  }

  const asteroidBeltSectorIds = new Set(asteroidBeltSectors.map((sector) => sector.id))
  const planetSectors = shuffle(
    sectors.filter((sector) => !asteroidBeltSectorIds.has(sector.id)),
    prng,
  ).slice(0, nbPlanets)

  for (const sector of planetSectors) {
    bodies.push(createBody({ sectorId: sector.id, bodyNumber: 1, bodyType: BodyType.PLANET, prng }))

    const nbMoons = rollIntegerRange(settings.nbMoonsPerPlanet, prng)
    for (let moonIndex = 0; moonIndex < nbMoons; moonIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: moonIndex + 2, bodyType: BodyType.MOON, prng }))
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

function createBody({
  sectorId,
  bodyNumber,
  bodyType,
  prng,
}: {
  sectorId: string
  bodyNumber: number
  bodyType: NewStarSystem["bodies"][number]["bodyType"]
  prng: Prng
}): NewStarSystem["bodies"][number] {
  return {
    id: randomUuid(prng),
    sectorId,
    bodyNumber,
    bodyType,
    name: `${toTitleCase(bodyType)} ${bodyNumber.toString().padStart(2, "0")}`,
    movementNodeId: randomUuid(prng),
  }
}

function generateMovementEdges({
  orbits,
  sectors,
  bodies,
}: {
  orbits: GeneratedOrbit[]
  sectors: GeneratedSector[]
  bodies: NewStarSystem["bodies"]
}): NewStarSystem["movementEdges"] {
  const edges = new Map<string, NewStarSystem["movementEdges"][number]>()
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

function addUndirectedEdge(edges: Map<string, NewStarSystem["movementEdges"][number]>, fromNodeId: string, toNodeId: string): void {
  addDirectedEdge(edges, fromNodeId, toNodeId)
  addDirectedEdge(edges, toNodeId, fromNodeId)
}

function addDirectedEdge(edges: Map<string, NewStarSystem["movementEdges"][number]>, fromNodeId: string, toNodeId: string): void {
  edges.set(`${fromNodeId}->${toNodeId}`, { fromNodeId, toNodeId, weight: MOVEMENT_EDGE_WEIGHT })
}

function rollPercentageRange(range: PercentageRange, prng: Prng): number {
  return range.min + prng() * (range.max - range.min)
}

function rollIntegerRange(range: IntegerRange, prng: Prng): number {
  return Math.floor(range.min + prng() * (range.max - range.min + 1))
}

function getSectorCountForOrbit(orbitNumber: number): number {
  return FIRST_ORBIT_SECTOR_COUNT * 2 ** (orbitNumber - 1)
}

function shuffle<T>(items: T[], prng: Prng): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(prng() * (index + 1))
    const item = shuffled[index]
    const swapItem = shuffled[swapIndex]
    if (item === undefined || swapItem === undefined) {
      throw new Error("Could not shuffle Star System values")
    }
    shuffled[index] = swapItem
    shuffled[swapIndex] = item
  }

  return shuffled
}

function randomUuid(prng: Prng): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(prng() * 256))
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
