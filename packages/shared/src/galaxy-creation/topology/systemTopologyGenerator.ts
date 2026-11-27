import { type Rng, Distance, UnitOfDistance, Range, type XY } from "@guillaume-docquier/tools-ts"
import { type PlanetTopology, planetTopologyGenerator } from "#shared/galaxy-creation/topology/planetTopologyGenerator.ts"
import { type StarTopology, starTopologyGenerator } from "#shared/galaxy-creation/topology/starTopologyGenerator.ts"

export type SystemTopology = {
  star: StarTopology
  planets: PlanetTopology[]
}

const ORBIT_SPACING = 5
const NB_ORBITS = 10
const POSSIBLE_ORBITS = Array.from({ length: NB_ORBITS }, (_, i) =>
  Distance.convert(Distance.create((i + 1) * ORBIT_SPACING, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS),
)

const PLANETS_RANGE = Range.integer({ min: 3, max: 7 })
export function systemTopologyGenerator(origin: XY, rng: Rng): SystemTopology {
  const nbPlanets = rng.int(PLANETS_RANGE)
  const orbits = rng.draw(POSSIBLE_ORBITS, nbPlanets).drawn

  return {
    star: starTopologyGenerator(origin, rng),
    planets: orbits.map((orbit) => planetTopologyGenerator(origin, orbit.value, rng)),
  }
}
