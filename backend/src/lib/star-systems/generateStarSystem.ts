import type { Body, NewStarSystem, Orbit, Sector, StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"
import { mulberry32Prng } from "../rng/mulberry32prng.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createRng, type Rng } from "#lib/rng/rng.ts"
import { Result } from "@guillaume-docquier/tools-ts"
import { v5 } from "uuid"
import { sum } from "#lib/sum.ts"
import { generateMovementEdges } from "#lib/star-systems/generateMovementEdges.ts"

function uuid(name: string): string {
  return v5(name, "7ce543cd-f7de-4efd-9cab-2c9c8a5711b5")
}

export const MAX_ORBITS = 6
const FIRST_ORBIT_SECTOR_COUNT = 2

/**
 * Deterministically generate a star system based on the StarSystemGenerationSettings.
 * A pseudorandom number generator will be used with the settings' seed to roll for all random numbers.
 *
 * The generation will try to respect the settings, but it's possible that the planetDensity cannot be respected because adding an orbit might imbalance it.
 * The other settings will be respected.
 */
export function generateStarSystem(settings: Readonly<StarSystemGenerationSettings>): Result<Omit<NewStarSystem, "gameId">, string> {
  // Create the PRNG
  const rng = createRng(mulberry32Prng(settings.seed))

  // Roll global values
  const planetDensity = rng.float(settings.planetDensity)
  const nbPlanets = rng.int(settings.nbPlanets)
  const nbAsteroidBelts = rng.int(settings.nbAsteroidBelts)

  // Generate orbits -> sectors -> bodies
  const orbitsResult = generateOrbits({ nbPlanets, nbAsteroidBelts, planetDensity, rng })
  if (Result.isFailure(orbitsResult)) {
    return orbitsResult
  }

  const { normalOrbits, asteroidBelts } = orbitsResult.value
  const { normalSectors, asteroidBeltSectors } = generateSectors({ normalOrbits, asteroidBelts })

  const orbits = [...normalOrbits, ...asteroidBelts]
  const sectors = [...normalSectors, ...asteroidBeltSectors]
  const bodies = generateBodies({ normalSectors, asteroidBeltSectors, nbPlanets, settings, rng })

  // Compute the movement graph
  const movementNodes = [
    ...sectors.map((sector) => ({ id: sector.movementNodeId })),
    ...bodies.map((body) => ({ id: body.movementNodeId })),
  ]
  const movementEdges = generateMovementEdges({ orbits, sectors, bodies })

  return Result.Success({
    starSystemGenerationSettings: settings,
    orbits,
    sectors,
    bodies,
    movementNodes,
    movementEdges,
  })
}

/**
 * Each new Orbit doubles the number of Sectors.
 */
function computeSectorCountForOrbit(orbit: Orbit): number {
  return FIRST_ORBIT_SECTOR_COUNT ** orbit.orbitNumber
}

/**
 * There are enough orbits if we can satisfy nbPlanets given planetDensity.
 * This assumes at most 1 planet per sector.
 */
function canFulfillNbPlanets({ orbits, planetDensity, nbPlanets }: { orbits: Orbit[]; planetDensity: number; nbPlanets: number }): boolean {
  return orbits.map(computeSectorCountForOrbit).reduce(sum, 0) * planetDensity >= nbPlanets
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
}): Result<{ normalOrbits: Orbit[]; asteroidBelts: Orbit[] }, string> {
  let normalOrbits: Orbit[] = []
  let asteroidBelts: Orbit[] = []

  while (asteroidBelts.length < nbAsteroidBelts || !canFulfillNbPlanets({ orbits: normalOrbits, planetDensity, nbPlanets })) {
    ;({ drawn: asteroidBelts, remaining: normalOrbits } = rng.draw(
      [...normalOrbits, ...asteroidBelts, createOrbit({ orbitNumber: normalOrbits.length + 1 })],
      nbAsteroidBelts,
    ))

    if (asteroidBelts.length + normalOrbits.length > MAX_ORBITS) {
      return Result.Failure(`Could not generate Star System within a reasonable amount of Orbits`)
    }
  }

  return Result.Success({ normalOrbits, asteroidBelts })
}

function createOrbit({ orbitNumber }: { orbitNumber: number }): Orbit {
  return {
    id: uuid(`orbit-${orbitNumber}`),
    orbitNumber,
  }
}

function generateSectors({ normalOrbits, asteroidBelts }: { normalOrbits: Orbit[]; asteroidBelts: Orbit[] }): {
  normalSectors: Sector[]
  asteroidBeltSectors: Sector[]
} {
  return {
    normalSectors: normalOrbits.flatMap(createSectorsForOrbit),
    asteroidBeltSectors: asteroidBelts.flatMap(createSectorsForOrbit),
  }
}

function createSectorsForOrbit(orbit: Orbit): Sector[] {
  return Array.from({ length: computeSectorCountForOrbit(orbit) }, (_, index) => {
    const sectorNumber = index + 1
    const sectorLabel = `${orbit.orbitNumber}-${sectorNumber}`

    return {
      id: uuid(`sector-${sectorLabel}`),
      orbitId: orbit.id,
      sectorNumber,
      movementNodeId: uuid(`movementNodeId-${sectorLabel}`),
    }
  })
}

function generateBodies({
  normalSectors,
  asteroidBeltSectors,
  nbPlanets,
  settings,
  rng,
}: {
  normalSectors: Sector[]
  asteroidBeltSectors: Sector[]
  nbPlanets: number
  settings: Pick<StarSystemGenerationSettings, "nbAsteroidsPerSector" | "nbMoonsPerPlanet">
  rng: Rng
}): Body[] {
  const bodies: Body[] = []

  // Create asteroids: random number in the range, per sector
  for (const sector of asteroidBeltSectors) {
    const nbAsteroids = rng.int(settings.nbAsteroidsPerSector)
    for (let asteroidIndex = 0; asteroidIndex < nbAsteroids; asteroidIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: asteroidIndex + 1, bodyType: BodyType.ASTEROID }))
    }
  }

  // Create planets: draw nbPlanets sectors, create the planet and add random number of moons in the range
  const { drawn: planetSectors } = rng.draw(normalSectors, nbPlanets)
  for (const sector of planetSectors) {
    bodies.push(createBody({ sectorId: sector.id, bodyNumber: 1, bodyType: BodyType.PLANET }))

    const nbMoons = rng.int(settings.nbMoonsPerPlanet)
    for (let moonIndex = 1; moonIndex <= nbMoons; moonIndex++) {
      bodies.push(createBody({ sectorId: sector.id, bodyNumber: moonIndex + 1, bodyType: BodyType.MOON }))
    }
  }

  return bodies
}

function createBody({ sectorId, bodyNumber, bodyType }: { sectorId: string; bodyNumber: number; bodyType: BodyType }): Body {
  const bodyLabel = `${sectorId}-${bodyNumber}`

  return {
    id: uuid(`body-${bodyLabel}`),
    sectorId,
    bodyNumber,
    bodyType,
    name: `${toTitleCase(bodyType)} ${bodyNumber.toString().padStart(2, "0")}`,
    movementNodeId: uuid(`movementNodeId-${bodyLabel}`),
  }
}

function toTitleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
