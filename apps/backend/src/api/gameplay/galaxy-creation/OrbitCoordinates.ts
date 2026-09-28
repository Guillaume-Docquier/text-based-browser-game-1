import { Distance, UnitOfDistance, type XY } from "@guillaume-docquier/tools-ts"

/**
 * Orbit coordinates is the distance in AU to the nearest star, padded with zeroes.
 */
export type OrbitCoordinates = string

/**
 * Orbit coordinates is the distance in AU to the nearest star, padded with zeroes.
 */
export function toOrbitCoordinates({ star, planet }: { star: XY; planet: XY }): OrbitCoordinates {
  const distanceLightYears = Math.hypot(planet.x - star.x, planet.y - star.y)
  const distanceAu = Distance.convert(Distance.create(distanceLightYears, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)

  return Math.round(distanceAu.value).toString().padStart(2, "0")
}
