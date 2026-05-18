import { Result } from "@guillaume-docquier/tools-ts"
import type {
  Body,
  MovementEdge,
  MovementNode,
  NewStarSystem,
  Orbit,
  Sector,
  StarSystemGenerationSettings,
} from "#lib/db/star-systems/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createMulberry32Prng, randomUint32, type Prng } from "#lib/mulberry32prng.ts"
import type { IntegerRange, PercentageRange } from "#lib/Range.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

export const MAX_ORBITS = 6

type OrbitPlan = {
  id: string
  orbitNumber: number
  sectorCount: number
  isAsteroidBelt: boolean
}

type GeneratedSector = Sector & {
  orbitNumber: number
  isAsteroidBelt: boolean
}

type BodyDraft = {
  sectorId: string
  bodyType: Body["bodyType"]
  name: string
}

export function generateStarSystem({
  gameId,
  generationSettings,
}: {
  gameId: number
  generationSettings: StarSystemGenerationSettings
}): Result<NewStarSystem, string> {
  const validateResult = validateGenerationSettings(generationSettings)
  if (Result.isFailure(validateResult)) {
    return validateResult
  }

  const prng = createMulberry32Prng(generationSettings.seed)
  const planetDensity = rollPercentageRange(generationSettings.planetDensity, prng)
  const nbPlanets = rollIntegerRange(generationSettings.nbPlanets, prng)
  const nbAsteroidBelts = rollIntegerRange(generationSettings.nbAsteroidBelts, prng)

  const orbitPlansResult = generateOrbitPlans({ planetDensity, nbPlanets, nbAsteroidBelts, prng })
  if (Result.isFailure(orbitPlansResult)) {
    return orbitPlansResult
  }

  const movementNodes: MovementNode[] = []
  const orbits: Orbit[] = []
  const sectors: Sector[] = []
  const generatedSectors: GeneratedSector[] = []
  const bodies: Body[] = []
  const bodyNumbersBySectorId = new Map<string, number>()

  function addMovementNode(): string {
    const id = nextUuid(prng)
    movementNodes.push({ id })

    return id
  }

  function addBody({ sectorId, bodyType, name }: BodyDraft): Body {
    const bodyNumber = (bodyNumbersBySectorId.get(sectorId) ?? 0) + 1
    bodyNumbersBySectorId.set(sectorId, bodyNumber)

    const body = {
      id: nextUuid(prng),
      sectorId,
      bodyNumber,
      bodyType,
      name,
      movementNodeId: addMovementNode(),
    } satisfies Body

    bodies.push(body)

    return body
  }

  for (const orbitPlan of orbitPlansResult.value) {
    orbits.push({ id: orbitPlan.id, orbitNumber: orbitPlan.orbitNumber })

    for (let sectorNumber = 1; sectorNumber <= orbitPlan.sectorCount; sectorNumber++) {
      const sector = {
        id: nextUuid(prng),
        orbitId: orbitPlan.id,
        sectorNumber,
        movementNodeId: addMovementNode(),
        orbitNumber: orbitPlan.orbitNumber,
        isAsteroidBelt: orbitPlan.isAsteroidBelt,
      } satisfies GeneratedSector

      sectors.push(toSector(sector))
      generatedSectors.push(sector)

      if (orbitPlan.isAsteroidBelt) {
        const nbAsteroids = rollIntegerRange(generationSettings.nbAsteroidsPerSector, prng)
        for (let asteroidIndex = 1; asteroidIndex <= nbAsteroids; asteroidIndex++) {
          addBody({
            sectorId: sector.id,
            bodyType: BodyType.ASTEROID,
            name: `Asteroid ${toCoordinates({ orbitNumber: sector.orbitNumber, sectorNumber: sector.sectorNumber })}-${asteroidIndex}`,
          })
        }
      }
    }
  }

  const planetCandidateSectors = shuffle(
    generatedSectors.filter((sector) => !sector.isAsteroidBelt),
    prng,
  )

  for (let planetIndex = 0; planetIndex < nbPlanets; planetIndex++) {
    const sector = planetCandidateSectors[planetIndex]
    if (sector === undefined) {
      return Result.Failure("Could not place every Planet in the generated Star System")
    }

    const planet = addBody({
      sectorId: sector.id,
      bodyType: BodyType.PLANET,
      name: `Planet ${toCoordinates({ orbitNumber: sector.orbitNumber, sectorNumber: sector.sectorNumber })}`,
    })

    const nbMoons = rollIntegerRange(generationSettings.nbMoonsPerPlanet, prng)
    for (let moonIndex = 1; moonIndex <= nbMoons; moonIndex++) {
      addBody({
        sectorId: sector.id,
        bodyType: BodyType.MOON,
        name: `Moon ${planet.name}-${moonIndex}`,
      })
    }
  }

  return Result.Success({
    gameId,
    generationSettings,
    movementNodes,
    orbits,
    sectors,
    bodies,
    movementEdges: createMovementEdges({ sectors: generatedSectors, bodies }),
  })
}

function validateGenerationSettings(generationSettings: StarSystemGenerationSettings): Result<true, string> {
  const ranges = [
    generationSettings.planetDensity,
    generationSettings.nbPlanets,
    generationSettings.nbMoonsPerPlanet,
    generationSettings.nbAsteroidBelts,
    generationSettings.nbAsteroidsPerSector,
  ]

  if (!ranges.every(isFiniteRange)) {
    return Result.Failure("Star System generation ranges must be finite numbers")
  }

  if (!ranges.every(({ min, max }) => min <= max)) {
    return Result.Failure("Star System generation range minimums must be less than or equal to maximums")
  }

  if (generationSettings.planetDensity.min < 0 || generationSettings.planetDensity.max > 1) {
    return Result.Failure("Planet density must stay between 0 and 1")
  }

  const integerRanges = [
    generationSettings.nbPlanets,
    generationSettings.nbMoonsPerPlanet,
    generationSettings.nbAsteroidBelts,
    generationSettings.nbAsteroidsPerSector,
  ]

  if (!integerRanges.every(({ min, max }) => Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= 0)) {
    return Result.Failure("Star System integer generation ranges must contain non-negative integers")
  }

  if (generationSettings.nbAsteroidBelts.max > MAX_ORBITS) {
    return Result.Failure(`Star System generation supports at most ${MAX_ORBITS} Asteroid belts`)
  }

  if (!Number.isInteger(generationSettings.seed) || generationSettings.seed < 0 || generationSettings.seed > 4_294_967_295) {
    return Result.Failure("Star System generation seed must be an unsigned 32-bit integer")
  }

  return Result.Success(true)
}

function isFiniteRange({ min, max }: IntegerRange | PercentageRange): boolean {
  return Number.isFinite(min) && Number.isFinite(max)
}

function generateOrbitPlans({
  planetDensity,
  nbPlanets,
  nbAsteroidBelts,
  prng,
}: {
  planetDensity: number
  nbPlanets: number
  nbAsteroidBelts: number
  prng: Prng
}): Result<OrbitPlan[], string> {
  const orbitPlans: OrbitPlan[] = []
  let remainingAsteroidBelts = nbAsteroidBelts
  let planetCapacity = 0

  for (let orbitNumber = 1; orbitNumber <= MAX_ORBITS; orbitNumber++) {
    const sectorCount = 2 ** orbitNumber
    const remainingOrbitSlots = MAX_ORBITS - orbitNumber + 1
    const mustPlaceAsteroidBelt = remainingAsteroidBelts === remainingOrbitSlots
    const planetCapacityAlreadySatisfied = Math.floor(planetCapacity) >= nbPlanets
    const isAsteroidBelt =
      remainingAsteroidBelts > 0 &&
      (planetCapacityAlreadySatisfied || mustPlaceAsteroidBelt || prng() < remainingAsteroidBelts / remainingOrbitSlots)

    if (isAsteroidBelt) {
      remainingAsteroidBelts--
    } else {
      planetCapacity += sectorCount * planetDensity
    }

    orbitPlans.push({
      id: nextUuid(prng),
      orbitNumber,
      sectorCount,
      isAsteroidBelt,
    })

    if (Math.floor(planetCapacity) >= nbPlanets && remainingAsteroidBelts === 0) {
      return Result.Success(orbitPlans)
    }
  }

  return Result.Failure(`Could not satisfy Star System generation settings within ${MAX_ORBITS} Orbits`)
}

function rollPercentageRange(range: PercentageRange, prng: Prng): number {
  return range.min + (range.max - range.min) * prng()
}

function rollIntegerRange(range: IntegerRange, prng: Prng): number {
  return Math.floor(range.min + prng() * (range.max - range.min + 1))
}

function nextUuid(prng: Prng): string {
  const first = randomUint32(prng).toString(16).padStart(8, "0")
  const second = randomUint32(prng).toString(16).padStart(8, "0")
  const third = randomUint32(prng).toString(16).padStart(8, "0")
  const fourth = randomUint32(prng).toString(16).padStart(8, "0")

  return `${first}-${second.slice(0, 4)}-4${second.slice(5, 8)}-a${third.slice(1, 4)}-${third.slice(4, 8)}${fourth}`
}

function shuffle<T>(items: T[], prng: Prng): T[] {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(prng() * (index + 1))
    const item = shuffled[index]
    const swapItem = shuffled[swapIndex]
    if (item === undefined || swapItem === undefined) {
      return shuffled
    }

    shuffled[index] = swapItem
    shuffled[swapIndex] = item
  }

  return shuffled
}

function toSector(generatedSector: GeneratedSector): Sector {
  return {
    id: generatedSector.id,
    orbitId: generatedSector.orbitId,
    sectorNumber: generatedSector.sectorNumber,
    movementNodeId: generatedSector.movementNodeId,
  }
}

function createMovementEdges({ sectors, bodies }: { sectors: GeneratedSector[]; bodies: Body[] }): MovementEdge[] {
  const edgesByKey = new Map<string, MovementEdge>()
  const sectorsByOrbitNumber = Map.groupBy(sectors, ({ orbitNumber }) => orbitNumber)
  const bodiesBySectorId = Map.groupBy(bodies, ({ sectorId }) => sectorId)

  function addDirectedEdge(fromNodeId: string, toNodeId: string): void {
    if (fromNodeId === toNodeId) {
      return
    }

    const key = `${fromNodeId}:${toNodeId}`
    if (edgesByKey.has(key)) {
      return
    }

    edgesByKey.set(key, { fromNodeId, toNodeId, weight: 1 })
  }

  function addUndirectedEdge(firstNodeId: string, secondNodeId: string): void {
    addDirectedEdge(firstNodeId, secondNodeId)
    addDirectedEdge(secondNodeId, firstNodeId)
  }

  for (const sector of sectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []

    for (const body of sectorBodies) {
      addUndirectedEdge(sector.movementNodeId, body.movementNodeId)
    }

    for (let firstIndex = 0; firstIndex < sectorBodies.length; firstIndex++) {
      const firstBody = sectorBodies[firstIndex]
      if (firstBody === undefined) {
        continue
      }

      for (let secondIndex = firstIndex + 1; secondIndex < sectorBodies.length; secondIndex++) {
        const secondBody = sectorBodies[secondIndex]
        if (secondBody !== undefined) {
          addUndirectedEdge(firstBody.movementNodeId, secondBody.movementNodeId)
        }
      }
    }
  }

  for (const orbitSectors of sectorsByOrbitNumber.values()) {
    const orderedSectors = [...orbitSectors].sort((first, second) => first.sectorNumber - second.sectorNumber)
    for (let index = 0; index < orderedSectors.length; index++) {
      const currentSector = orderedSectors[index]
      const nextSector = orderedSectors[(index + 1) % orderedSectors.length]
      if (currentSector !== undefined && nextSector !== undefined) {
        addUndirectedEdge(currentSector.movementNodeId, nextSector.movementNodeId)
      }
    }
  }

  const orbitNumbers = [...sectorsByOrbitNumber.keys()].sort((first, second) => first - second)
  for (let orbitIndex = 0; orbitIndex < orbitNumbers.length - 1; orbitIndex++) {
    const innerOrbitNumber = orbitNumbers[orbitIndex]
    const outerOrbitNumber = orbitNumbers[orbitIndex + 1]
    if (innerOrbitNumber === undefined || outerOrbitNumber === undefined) {
      continue
    }

    const innerSectors = sectorsByOrbitNumber.get(innerOrbitNumber) ?? []
    const outerSectors = sectorsByOrbitNumber.get(outerOrbitNumber) ?? []
    const outerSectorsByNumber = new Map(outerSectors.map((sector) => [sector.sectorNumber, sector]))

    for (const innerSector of innerSectors) {
      const firstOuterSector = outerSectorsByNumber.get((innerSector.sectorNumber - 1) * 2 + 1)
      const secondOuterSector = outerSectorsByNumber.get((innerSector.sectorNumber - 1) * 2 + 2)

      if (firstOuterSector !== undefined) {
        addUndirectedEdge(innerSector.movementNodeId, firstOuterSector.movementNodeId)
      }

      if (secondOuterSector !== undefined) {
        addUndirectedEdge(innerSector.movementNodeId, secondOuterSector.movementNodeId)
      }
    }
  }

  return [...edgesByKey.values()]
}
