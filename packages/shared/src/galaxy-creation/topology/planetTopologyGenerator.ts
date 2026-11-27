import { Distance, Range, type Rng, UnitOfDistance, type XY } from "@guillaume-docquier/tools-ts"

export type PlanetTopology = XY & {
  readonly orbitDistanceAU: number
}

const ANGLE_RANGE = Range.float({ min: 0, max: 2 * Math.PI })

export function planetTopologyGenerator(starPosition: XY, orbitDistanceAU: number, rng: Rng): PlanetTopology {
  const angle = rng.float(ANGLE_RANGE)
  const radiusLightYears = Distance.in(Distance.create(orbitDistanceAU, UnitOfDistance.ASTRONOMICAL_UNITS), UnitOfDistance.LIGHT_YEARS)

  return {
    x: starPosition.x + radiusLightYears * Math.cos(angle),
    y: starPosition.y + radiusLightYears * Math.sin(angle),
    orbitDistanceAU,
  }
}
