import { createHash } from "node:crypto"
import { Result } from "@guillaume-docquier/tools-ts"
import { type NewStarSystem, type StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"
import { createMulberry32Prng, type Mulberry32Prng } from "#lib/mulberry32prng.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

export const MAX_ORBITS = 6

type GeneratedOrbit = NewStarSystem["orbits"][number] & {
  sectorCount: number
  isAsteroidBelt: boolean
}

type GeneratedSector = NewStarSystem["sectors"][number] & {
  orbitNumber: number
}

type GeneratedBody = NewStarSystem["bodies"][number] & {
  orbitNumber: number
  sectorNumber: number
}

export function generateStarSystem({
  gameId,
  generationSettings,
}: {
  gameId: number
  generationSettings: StarSystemGenerationSettings
}): Result<NewStarSystem, string> {
  const prng = createMulberry32Prng(generationSettings.seed)
  const planetDensity = rollFloat(prng, generationSettings.planetDensity)
  const nbPlanets = prng.nextInteger(generationSettings.nbPlanets)
  const nbAsteroidBelts = prng.nextInteger(generationSettings.nbAsteroidBelts)

  if (nbAsteroidBelts > MAX_ORBITS) {
    return Result.Failure(`Cannot generate ${nbAsteroidBelts} asteroid belts with a ${MAX_ORBITS} orbit limit`)
  }

  const orbitCountResult = getMinimalOrbitCount({ planetDensity, nbPlanets, nbAsteroidBelts, seed: generationSettings.seed })
  if (Result.isFailure(orbitCountResult)) {
    return Result.Failure(orbitCountResult.error)
  }

  const orbitCount = orbitCountResult.value
  const asteroidBeltOrbitNumbers = chooseAsteroidBeltOrbitNumbers({ orbitCount, nbAsteroidBelts, seed: generationSettings.seed })

  const orbits = Array.from({ length: orbitCount }, (_, index): GeneratedOrbit => {
    const orbitNumber = index + 1

    return {
      id: deterministicUuid({ gameId, seed: generationSettings.seed, kind: "orbit", key: `${orbitNumber}` }),
      orbitNumber,
      sectorCount: getSectorCount(orbitNumber),
      isAsteroidBelt: asteroidBeltOrbitNumbers.has(orbitNumber),
    }
  })

  const sectors = orbits.flatMap((orbit): GeneratedSector[] =>
    Array.from({ length: orbit.sectorCount }, (_, index): GeneratedSector => {
      const sectorNumber = index + 1

      return {
        id: deterministicUuid({ gameId, seed: generationSettings.seed, kind: "sector", key: `${orbit.orbitNumber}:${sectorNumber}` }),
        orbitId: orbit.id,
        orbitNumber: orbit.orbitNumber,
        sectorNumber,
        movementNodeId: deterministicUuid({
          gameId,
          seed: generationSettings.seed,
          kind: "movement-node",
          key: `sector:${orbit.orbitNumber}:${sectorNumber}`,
        }),
      }
    }),
  )

  const bodies = generateBodies({ gameId, generationSettings, nbPlanets, prng, orbits, sectors })
  const movementNodes = [
    ...sectors.map(({ movementNodeId }) => ({ id: movementNodeId })),
    ...bodies.map(({ movementNodeId }) => ({ id: movementNodeId })),
  ]
  const movementEdges = generateMovementEdges({ orbits, sectors, bodies })

  return Result.Success({
    gameId,
    generationSettings,
    movementNodes,
    orbits: orbits.map(({ id, orbitNumber }) => ({ id, orbitNumber })),
    sectors: sectors.map(({ id, orbitId, sectorNumber, movementNodeId }) => ({ id, orbitId, sectorNumber, movementNodeId })),
    bodies: bodies.map(({ id, sectorId, bodyNumber, bodyType, name, movementNodeId }) => ({
      id,
      sectorId,
      bodyNumber,
      bodyType,
      name,
      movementNodeId,
    })),
    movementEdges,
  })
}

function generateBodies({
  gameId,
  generationSettings,
  nbPlanets,
  prng,
  orbits,
  sectors,
}: {
  gameId: number
  generationSettings: StarSystemGenerationSettings
  nbPlanets: number
  prng: Mulberry32Prng
  orbits: GeneratedOrbit[]
  sectors: GeneratedSector[]
}): GeneratedBody[] {
  const asteroidBeltOrbitNumbers = new Set(orbits.filter(({ isAsteroidBelt }) => isAsteroidBelt).map(({ orbitNumber }) => orbitNumber))
  const bodies: GeneratedBody[] = []

  for (const sector of sectors.filter(({ orbitNumber }) => asteroidBeltOrbitNumbers.has(orbitNumber))) {
    const nbAsteroids = prng.nextInteger(generationSettings.nbAsteroidsPerSector)
    for (let index = 0; index < nbAsteroids; index += 1) {
      bodies.push(createBody({ gameId, seed: generationSettings.seed, sector, bodyNumber: index + 1, bodyType: BodyType.ASTEROID }))
    }
  }

  const planetSectors = prng
    .shuffle(sectors.filter(({ orbitNumber }) => !asteroidBeltOrbitNumbers.has(orbitNumber)))
    .slice(0, nbPlanets)
    .sort(sortByOrbitAndSector)

  for (const sector of planetSectors) {
    bodies.push(createBody({ gameId, seed: generationSettings.seed, sector, bodyNumber: 1, bodyType: BodyType.PLANET }))

    const nbMoons = prng.nextInteger(generationSettings.nbMoonsPerPlanet)
    for (let moonIndex = 0; moonIndex < nbMoons; moonIndex += 1) {
      bodies.push(createBody({ gameId, seed: generationSettings.seed, sector, bodyNumber: moonIndex + 2, bodyType: BodyType.MOON }))
    }
  }

  return bodies.sort((left, right) => {
    const sectorSort = sortByOrbitAndSector(left, right)
    if (sectorSort !== 0) {
      return sectorSort
    }

    return left.bodyNumber - right.bodyNumber
  })
}

function createBody({
  gameId,
  seed,
  sector,
  bodyNumber,
  bodyType,
}: {
  gameId: number
  seed: number
  sector: GeneratedSector
  bodyNumber: number
  bodyType: GeneratedBody["bodyType"]
}): GeneratedBody {
  const coordinates = toCoordinates({ orbitNumber: sector.orbitNumber, sectorNumber: sector.sectorNumber, bodyNumber })

  return {
    id: deterministicUuid({ gameId, seed, kind: "body", key: coordinates }),
    sectorId: sector.id,
    orbitNumber: sector.orbitNumber,
    sectorNumber: sector.sectorNumber,
    bodyNumber,
    bodyType,
    name: toBodyName({ bodyType, coordinates }),
    movementNodeId: deterministicUuid({ gameId, seed, kind: "movement-node", key: `body:${coordinates}` }),
  }
}

function generateMovementEdges({
  orbits,
  sectors,
  bodies,
}: {
  orbits: GeneratedOrbit[]
  sectors: GeneratedSector[]
  bodies: GeneratedBody[]
}): NewStarSystem["movementEdges"] {
  const edges = new Map<string, NewStarSystem["movementEdges"][number]>()
  const sectorsByOrbitNumber = Map.groupBy(sectors, ({ orbitNumber }) => orbitNumber)
  const bodiesBySectorId = Map.groupBy(bodies, ({ sectorId }) => sectorId)

  for (const sector of sectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []

    for (const body of sectorBodies) {
      addUndirectedEdge(edges, sector.movementNodeId, body.movementNodeId)
    }

    for (let leftIndex = 0; leftIndex < sectorBodies.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sectorBodies.length; rightIndex += 1) {
        const leftBody = sectorBodies[leftIndex]
        const rightBody = sectorBodies[rightIndex]
        if (leftBody !== undefined && rightBody !== undefined) {
          addUndirectedEdge(edges, leftBody.movementNodeId, rightBody.movementNodeId)
        }
      }
    }
  }

  for (const orbit of orbits) {
    const orbitSectors = (sectorsByOrbitNumber.get(orbit.orbitNumber) ?? []).sort((left, right) => left.sectorNumber - right.sectorNumber)

    for (const sector of orbitSectors) {
      const nextSectorNumber = sector.sectorNumber === orbitSectors.length ? 1 : sector.sectorNumber + 1
      const nextSector = orbitSectors.find((candidate) => candidate.sectorNumber === nextSectorNumber)
      if (nextSector !== undefined) {
        addUndirectedEdge(edges, sector.movementNodeId, nextSector.movementNodeId)
      }
    }
  }

  for (const outerOrbit of orbits.filter(({ orbitNumber }) => orbitNumber > 1)) {
    const innerSectors = sectorsByOrbitNumber.get(outerOrbit.orbitNumber - 1) ?? []
    const outerSectors = sectorsByOrbitNumber.get(outerOrbit.orbitNumber) ?? []

    for (const innerSector of innerSectors) {
      const firstOuterSector = outerSectors.find(({ sectorNumber }) => sectorNumber === innerSector.sectorNumber * 2 - 1)
      const secondOuterSector = outerSectors.find(({ sectorNumber }) => sectorNumber === innerSector.sectorNumber * 2)

      for (const outerSector of [firstOuterSector, secondOuterSector]) {
        if (outerSector !== undefined) {
          addUndirectedEdge(edges, innerSector.movementNodeId, outerSector.movementNodeId)
        }
      }
    }
  }

  return Array.from(edges.values())
}

function getMinimalOrbitCount({
  planetDensity,
  nbPlanets,
  nbAsteroidBelts,
  seed,
}: {
  planetDensity: number
  nbPlanets: number
  nbAsteroidBelts: number
  seed: number
}): Result<number, string> {
  for (let orbitCount = Math.max(1, nbAsteroidBelts); orbitCount <= MAX_ORBITS; orbitCount += 1) {
    const asteroidBeltOrbitNumbers = chooseAsteroidBeltOrbitNumbers({ orbitCount, nbAsteroidBelts, seed })
    const nonBeltSectorCount = Array.from({ length: orbitCount }, (_, index) => index + 1)
      .filter((orbitNumber) => !asteroidBeltOrbitNumbers.has(orbitNumber))
      .reduce((total, orbitNumber) => total + getSectorCount(orbitNumber), 0)

    if (Math.floor(nonBeltSectorCount * planetDensity) >= nbPlanets) {
      return Result.Success(orbitCount)
    }
  }

  return Result.Failure(`Cannot place ${nbPlanets} planets within ${MAX_ORBITS} orbits`)
}

function chooseAsteroidBeltOrbitNumbers({
  orbitCount,
  nbAsteroidBelts,
  seed,
}: {
  orbitCount: number
  nbAsteroidBelts: number
  seed: number
}): Set<number> {
  const beltPrng = createMulberry32Prng(seed ^ 0x9e3779b9 ^ orbitCount)
  const orbitNumbers = Array.from({ length: orbitCount }, (_, index) => index + 1)

  return new Set(beltPrng.shuffle(orbitNumbers).slice(0, nbAsteroidBelts))
}

function addUndirectedEdge(edges: Map<string, NewStarSystem["movementEdges"][number]>, leftNodeId: string, rightNodeId: string): void {
  addDirectedEdge(edges, leftNodeId, rightNodeId)
  addDirectedEdge(edges, rightNodeId, leftNodeId)
}

function addDirectedEdge(edges: Map<string, NewStarSystem["movementEdges"][number]>, fromNodeId: string, toNodeId: string): void {
  if (fromNodeId === toNodeId) {
    return
  }

  edges.set(`${fromNodeId}:${toNodeId}`, { fromNodeId, toNodeId, weight: 1 })
}

function getSectorCount(orbitNumber: number): number {
  return 2 ** orbitNumber
}

function rollFloat(prng: Mulberry32Prng, range: { min: number; max: number }): number {
  return prng.nextFloat() * (range.max - range.min) + range.min
}

function sortByOrbitAndSector(
  left: { orbitNumber: number; sectorNumber: number },
  right: { orbitNumber: number; sectorNumber: number },
): number {
  const orbitSort = left.orbitNumber - right.orbitNumber
  if (orbitSort !== 0) {
    return orbitSort
  }

  return left.sectorNumber - right.sectorNumber
}

function toBodyName({ bodyType, coordinates }: { bodyType: GeneratedBody["bodyType"]; coordinates: string }): string {
  switch (bodyType) {
    case BodyType.PLANET:
      return `Planet ${coordinates}`
    case BodyType.MOON:
      return `Moon ${coordinates}`
    case BodyType.ASTEROID:
      return `Asteroid ${coordinates}`
  }
}

function deterministicUuid({ gameId, seed, kind, key }: { gameId: number; seed: number; kind: string; key: string }): string {
  const hash = createHash("sha256").update(`${gameId}:${seed}:${kind}:${key}`).digest("hex")
  const variant = ((Number.parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16)

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}
