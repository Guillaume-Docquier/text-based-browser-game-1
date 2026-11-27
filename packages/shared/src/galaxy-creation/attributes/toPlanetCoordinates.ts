import type { PlanetCoordinates } from "#shared/domain/world/planets/PlanetCoordinates.ts"
import type { StarCoordinates } from "#shared/domain/world/stars/StarCoordinates.ts"
import { toOrbitCoordinates } from "#shared/galaxy-creation/attributes/toOrbitCoordinates.ts"

export function toPlanetCoordinates({
  starCoordinates,
  orbitDistanceAU,
}: {
  starCoordinates: StarCoordinates
  orbitDistanceAU: number
}): PlanetCoordinates {
  return `${starCoordinates}:${toOrbitCoordinates(orbitDistanceAU)}`
}
