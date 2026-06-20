import { createRng, mulberry32Prng, Range, Result, type Rng, Sort } from "@guillaume-docquier/tools-ts"
import { v7 } from "uuid"
import type {
  NewBodyModel,
  NewMovementEdgeModel,
  NewMovementNodeModel,
  NewOrbitModel,
  NewSectorModel,
  NewStarSystemModel,
} from "#api/gameplay/star-systems/StarSystemModels.ts"
import type { Clock } from "#lib/Clock.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"

const MAX_ORBITS = 6
const FIRST_ORBIT_SECTOR_COUNT = 2

type GeneratedOrbit = NewOrbitModel & {
  sectorCount: number
  isAsteroidBelt: boolean
}

type GeneratedSector = NewSectorModel & {
  orbitNumber: number
  bodyCount: number
  isAsteroidSector: boolean
}

export function generateStarSystem({
  settings,
  clock,
}: {
  settings: Readonly<StarSystemGenerationSettings>
  clock: Clock
}): Result<NewStarSystemModel, string> {
  const invalidSettingsReason = validateSettings(settings)
  if (invalidSettingsReason !== undefined) {
    return Result.Failure(invalidSettingsReason)
  }

  // Create the PRNG
  const rng = createRng(mulberry32Prng(settings.seed))
  const uuidFactory = createUuidFactory({ rng, clock })

  // Roll global values
  const planetDensity = rng.random(settings.planetDensity)
  const nbPlanets = rng.random(settings.nbPlanets)
  const nbAsteroidBelts = rng.random(settings.nbAsteroidBelts)

  // Generate orbits -> sectors -> bodies
  const orbitsResult = generateOrbits({ nbPlanets, nbAsteroidBelts, planetDensity, rng, uuidFactory })
  if (Result.isFailure(orbitsResult)) {
    return orbitsResult
  }

  const orbits = orbitsResult.value
  const sectors = generateSectors({ orbits, rng, uuidFactory, settings })
  const bodies = generateBodies({ sectors, nbPlanets, rng, uuidFactory, settings })

  // Compute movements graph
  const movementNodes: NewMovementNodeModel[] = [
    ...sectors.map((sector) => ({ id: sector.movementNodeId })),
    ...bodies.map((sector) => ({ id: sector.movementNodeId })),
  ]
  const movementEdges = generateMovementEdges({ sectors, bodies })

  // Tadaa!
  return Result.Success({
    orbits,
    sectors,
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

function generateOrbits({
  nbPlanets,
  planetDensity,
  nbAsteroidBelts,
  rng,
  uuidFactory,
}: {
  nbPlanets: number
  planetDensity: number
  nbAsteroidBelts: number
  rng: Rng
  uuidFactory: UuidFactory
}): Result<GeneratedOrbit[], string> {
  // We first compute the required number of orbits to satisfy the sector count, then we add nbAsteroidBelts as extra outer belts
  // This guarantees that we can fulfill the sector count, but might overshoot it if the belts roll on lower orbits
  const requiredSectorCount = computeRequiredSectorCount({ nbPlanets, planetDensity })
  const requiredOrbitCount = computeRequiredOrbitCount(requiredSectorCount) + nbAsteroidBelts

  if (requiredOrbitCount > MAX_ORBITS) {
    return Result.Failure(`This star system requires more than the maximum allowed orbits count (${MAX_ORBITS}).`)
  }

  // Then we roll the asteroid belts
  const { drawn: asteroidOrbitNumbers, remaining: orbitNumbers } = rng.draw(
    Array.from({ length: requiredOrbitCount }, (_, i) => i + 1),
    nbAsteroidBelts,
  )

  // Generate and order orbits
  const orbits = [
    ...asteroidOrbitNumbers.map((orbitNumber) => generateOrbit({ orbitNumber, isAsteroidBelt: true, uuidFactory })),
    ...orbitNumbers.map((orbitNumber) => generateOrbit({ orbitNumber, isAsteroidBelt: false, uuidFactory })),
  ].sort(Sort.byAscendingProperty("orbitNumber"))

  // And we trim the orbits to avoid the overshoot
  let maxSectorCount = orbits.reduce((sectorCount, orbit) => {
    return orbit.isAsteroidBelt ? sectorCount : sectorCount + orbit.sectorCount
  }, 0)

  let lastOrbit = orbits.at(-1)
  while (lastOrbit !== undefined && !lastOrbit.isAsteroidBelt && maxSectorCount - lastOrbit.sectorCount > requiredSectorCount) {
    maxSectorCount -= lastOrbit.sectorCount
    lastOrbit = orbits.pop()
  }

  // And done!
  return Result.Success(orbits)
}

function computeRequiredSectorCount({ nbPlanets, planetDensity }: { nbPlanets: number; planetDensity: number }): number {
  return Math.ceil(nbPlanets / planetDensity)
}

/**
 * This assumes FIRST_ORBIT_SECTOR_COUNT === 2 and doubles for every orbit
 */
function computeRequiredOrbitCount(requiredSectorCount: number): number {
  // This assumes the first sector count is 2 and doubles for every new orbit
  // Given X orbits, the total sector count S is `S = 2^1 + 2^2 + 2^3 + ... + 2^X`
  // This is a geometric series that can be simplified to `S = 2^X+1 - 2`
  // To compute S given X, such that `S >= 2^X+1 - 2`, the formula is `ceil(log2(S + 2)) - 1:
  // - S + 2 >= 2^X+1
  // - log2(S + 2) >= X + 1
  // - ceil(log2(S + 2)) = X + 1
  // - ceil(log2(S + 2)) - 1 = X
  return Math.ceil(Math.log2(requiredSectorCount + 2)) - 1
}

function generateOrbit({
  orbitNumber,
  isAsteroidBelt,
  uuidFactory,
}: {
  orbitNumber: number
  isAsteroidBelt: boolean
  uuidFactory: UuidFactory
}): GeneratedOrbit {
  return {
    id: uuidFactory(),
    isAsteroidBelt,
    orbitNumber,
    sectorCount: FIRST_ORBIT_SECTOR_COUNT ** orbitNumber,
  }
}

function generateSectors({
  orbits,
  rng,
  uuidFactory,
  settings,
}: {
  orbits: GeneratedOrbit[]
  rng: Rng
  uuidFactory: UuidFactory
  settings: Readonly<StarSystemGenerationSettings>
}): GeneratedSector[] {
  return orbits.flatMap((orbit) =>
    Array.from({ length: orbit.sectorCount }, (_, i) => {
      const sectorNumber = i + 1
      const angleSpan = Math.floor(360 / orbit.sectorCount)
      const minAngle = angleSpan * i
      const maxAngle = sectorNumber === orbit.sectorCount ? 360 : minAngle + angleSpan // last sectors takes all remaining space due to rounding errors

      return {
        id: uuidFactory(),
        orbitId: orbit.id,
        orbitNumber: orbit.orbitNumber,
        sectorNumber,
        angleRange: Range.create({ numericType: "integer", maxBoundType: "exclusive", min: minAngle, max: maxAngle }),
        bodyCount: orbit.isAsteroidBelt ? rng.random(settings.nbAsteroidsPerSector) : 1,
        isAsteroidSector: orbit.isAsteroidBelt,
        movementNodeId: uuidFactory(),
      }
    }),
  )
}

function generateBodies({
  sectors,
  nbPlanets,
  rng,
  uuidFactory,
  settings,
}: {
  sectors: GeneratedSector[]
  nbPlanets: number
  rng: Rng
  uuidFactory: UuidFactory
  settings: Readonly<StarSystemGenerationSettings>
}): NewBodyModel[] {
  const asteroidSectors = sectors.filter((sector) => sector.isAsteroidSector)
  const normalSectors = sectors.filter((sector) => !sector.isAsteroidSector)
  const bodies: NewBodyModel[] = []

  for (const sector of asteroidSectors) {
    bodies.push(
      ...Array.from({ length: sector.bodyCount }, (_, i) =>
        generateBody({ sector, bodyNumber: i + 1, uuidFactory, bodyType: BodyType.ASTEROID }),
      ),
    )
  }

  const { drawn: planetSectors } = rng.draw(normalSectors, nbPlanets)
  for (const sector of planetSectors) {
    const nbMoons = rng.random(settings.nbMoonsPerPlanet)
    bodies.push(
      generateBody({ sector, bodyNumber: 1, uuidFactory, bodyType: BodyType.PLANET }),
      ...Array.from({ length: nbMoons }, (_, i) => generateBody({ sector, bodyNumber: i + 2, uuidFactory, bodyType: BodyType.MOON })),
    )
  }

  return bodies
}

function generateBody({
  sector,
  bodyNumber,
  uuidFactory,
  bodyType,
}: {
  sector: GeneratedSector
  bodyNumber: number
  uuidFactory: UuidFactory
  bodyType: BodyType
}): NewBodyModel {
  return {
    id: uuidFactory(),
    sectorId: sector.id,
    bodyNumber,
    // We'll do better in the future
    name: `${toTitleCase(bodyType)} ${bodyNumber.toString().padStart(2, "0")}`,
    bodyType,
    movementNodeId: uuidFactory(),
  }
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

type UuidFactory = () => string
function createUuidFactory({ rng, clock }: { rng: Rng; clock: Clock }): UuidFactory {
  let sequence = 0

  return () =>
    v7({
      random: Uint8Array.from({ length: 16 }, () => rng.int(Range.integer({ min: 0, max: 255 }))),
      msecs: clock.now().getTime(),
      seq: sequence++,
    })
}

/**
 * We can only move to Sectors and Bodies:
 * - Each Body is connected to all Bodies in the same Sector.
 * - Each Body in a Sector is connected to that Sector.
 * - Each Sector is connected to all adjacent Sectors.
 */
function generateMovementEdges({ sectors, bodies }: { sectors: GeneratedSector[]; bodies: NewBodyModel[] }): NewMovementEdgeModel[] {
  const movementEdges: NewMovementEdgeModel[] = []
  const bodiesBySectorId = Map.groupBy(bodies, (body) => body.sectorId)

  // Yeah this is O(n^2)
  for (const sector of sectors) {
    const adjacentSectors = sectors.filter((otherSector) => areSectorsAdjacent(sector, otherSector))
    for (const adjacentSector of adjacentSectors) {
      movementEdges.push(generateMovementEdge(sector.movementNodeId, adjacentSector.movementNodeId))
    }

    // Some sectors don't have bodies
    const bodiesInSector = bodiesBySectorId.get(sector.id) ?? []

    for (const body of bodiesInSector) {
      movementEdges.push(generateMovementEdge(body.movementNodeId, sector.movementNodeId))
      movementEdges.push(generateMovementEdge(sector.movementNodeId, body.movementNodeId))

      for (const otherBody of bodiesInSector) {
        // Don't count yourself
        if (body.id !== otherBody.id) {
          movementEdges.push(generateMovementEdge(body.movementNodeId, otherBody.movementNodeId))
        }
      }
    }
  }

  return movementEdges
}

/**
 * Sectors are laterally adjacent if they are on the same orbit and touch (min === max || max === min)
 * Sectors on different orbits are adjacent if they are 1 orbit away and they angle range overlaps
 */
function areSectorsAdjacent(firstSector: GeneratedSector, secondSector: GeneratedSector): boolean {
  if (firstSector.id === secondSector.id) {
    // Don't count yourself
    return false
  }

  const orbitDistance = Math.abs(firstSector.orbitNumber - secondSector.orbitNumber)
  if (orbitDistance > 1) {
    return false
  }

  if (orbitDistance === 1) {
    return Range.overlaps(firstSector.angleRange, secondSector.angleRange)
  }

  return (
    firstSector.angleRange.max % 360 === secondSector.angleRange.min || secondSector.angleRange.max % 360 === firstSector.angleRange.min
  )
}

export function generateMovementEdge(fromNodeId: string, toNodeId: string): NewMovementEdgeModel {
  return {
    fromNodeId,
    toNodeId,
    // Maybe that'll change
    weight: 1,
  }
}
