import type { Planet, Galaxy } from "@api-types"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import type { StarSystem } from "shared/domain/world/StarSystem.ts"
export function observedPlanetStub(overrides: Parameters<typeof createPlanetStub>[0] = {}): Exclude<Planet, { observation: "unknown" }> {
  return { ...createPlanetStub(overrides), observation: "current", observedTurn: 1 }
}
export function observedSystemStub(system: StarSystem): Galaxy["systems"][number] {
  return { star: system.star, planets: system.planets.map((planet) => ({ ...planet, observation: "current", observedTurn: 1 })) }
}
export function unknownPlanetStub(planet: Planet): Extract<Planet, { observation: "unknown" }> {
  return {
    ...planet,
    observation: "unknown",
    observedTurn: null,
    ownerPlayerId: null,
    biome: null,
    size: null,
    area: null,
    metalProduction: null,
    remainingMetalDeposit: null,
  }
}
