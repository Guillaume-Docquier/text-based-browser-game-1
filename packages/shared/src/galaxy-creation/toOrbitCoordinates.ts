import type { OrbitCoordinates } from "#shared/domain/world/planets/OrbitCoordinates.ts"

export function toOrbitCoordinates(orbitDistanceAU: number): OrbitCoordinates {
  return Math.round(orbitDistanceAU).toString().padStart(2, "0")
}
