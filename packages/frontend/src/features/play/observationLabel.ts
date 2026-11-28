import type { Planet } from "@api-types"
export function observationLabel(planet: Planet): string {
  if (planet.observation === "remembered") {
    return `Last observed · Turn ${planet.observedTurn}`
  }
  return planet.observation === "current" ? "Current vision" : "Unknown"
}
