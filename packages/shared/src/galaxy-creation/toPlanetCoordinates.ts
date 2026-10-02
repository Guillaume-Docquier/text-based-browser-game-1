import type { XY } from "@guillaume-docquier/tools-ts"
import type { PlanetCoordinates } from "#shared/domain/world/planets/PlanetCoordinates.ts"
import type { StarCoordinates } from "#shared/domain/world/stars/StarCoordinates.ts"
import { toOrbitCoordinates } from "#shared/galaxy-creation/toOrbitCoordinates.ts"

/**
 * Combines a star coordinate with the planet's rounded orbital distance in AU.
 */
export function toPlanetCoordinates({
  starCoordinates,
  star,
  planet,
}: {
  starCoordinates: StarCoordinates
  star: XY
  planet: XY
}): PlanetCoordinates {
  return `${starCoordinates}:${toOrbitCoordinates({ star, planet })}`
}
