import { type Rng, Distance, UnitOfDistance, Range } from "@guillaume-docquier/tools-ts"
import { type Planet, planetGenerator } from "#lib/map/planet.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { type Star, starGenerator } from "#lib/map/star.generator.ts"

export type System = {
  star: Star
  planets: Planet[]
}

/**
 * Orbits between 1 and 50 AU
 */
const POSSIBLE_ORBITS = Array.from({ length: 49 }, (_, i) =>
  Distance.convert(Distance.create(i + 1, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS),
)

const PLANETS_RANGE = Range.integer({ min: 3, max: 7 })
export function systemGenerator(origin: Point2D, rng: Rng): System {
  const nbPlanets = rng.int(PLANETS_RANGE)
  const orbits = rng.draw(POSSIBLE_ORBITS, nbPlanets).drawn

  return {
    star: starGenerator(origin, rng),
    planets: orbits.map((orbit) => planetGenerator(origin, orbit.value, rng)),
  }
}
