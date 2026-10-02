import { Distance, UnitOfDistance, type XY } from "@guillaume-docquier/tools-ts"
import type { OrbitCoordinates } from "#shared/domain/world/planets/OrbitCoordinates.ts"

/**
 * Converts orbital distance to rounded AU, padded to at least two digits.
 */
export function toOrbitCoordinates({ star, planet }: { star: XY; planet: XY }): OrbitCoordinates {
  const distanceLightYears = Math.hypot(planet.x - star.x, planet.y - star.y)
  const distanceAu = Distance.convert(Distance.create(distanceLightYears, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)

  return Math.round(distanceAu.value).toString().padStart(2, "0")
}
