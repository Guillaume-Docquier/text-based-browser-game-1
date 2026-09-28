import { type Rng, Distance, UnitOfDistance, Range, type XY } from "@guillaume-docquier/tools-ts"
import { type GeneratedPlanet, planetGenerator } from "#lib/map-generation/planet.generator.ts"
import { type GeneratedStar, starGenerator } from "#lib/map-generation/star.generator.ts"

export type GeneratedSystem = {
  star: GeneratedStar
  planets: GeneratedPlanet[]
}

const ORBIT_SPACING = 5
const NB_ORBITS = 10
/**
 * Orbits between DISTANCE_MIN and DISTANCE_MAX AU
 */
const POSSIBLE_ORBITS = Array.from({ length: NB_ORBITS }, (_, i) =>
  Distance.convert(Distance.create((i + 1) * ORBIT_SPACING, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS),
)

const PLANETS_RANGE = Range.integer({ min: 3, max: 7 })
export function systemGenerator(origin: XY, rng: Rng): GeneratedSystem {
  const nbPlanets = rng.int(PLANETS_RANGE)
  const orbits = rng.draw(POSSIBLE_ORBITS, nbPlanets).drawn

  return {
    star: starGenerator(origin, rng),
    planets: orbits.map((orbit) => planetGenerator(origin, orbit.value, rng)),
  }
}
