import { branded } from "@guillaume-docquier/tools-ts"
import { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import type { StarId } from "#lib/db/stars/StarId.ts"
import type { GalaxyModel } from "./gameplay.repository.ts"

type GalaxySystemModel = GalaxyModel["systems"][number]
type GalaxyPlanetModel = GalaxySystemModel["planets"][number]

export function createGalaxyModelStub(overrides: Partial<GalaxyModel> = {}): GalaxyModel {
  return { systems: [], ...overrides }
}

export function createGalaxySystemModelStub(overrides: Partial<GalaxySystemModel> = {}): GalaxySystemModel {
  return {
    star: {
      id: branded<StarId>(1),
      name: "star",
      coordinates: "0:0",
      x: 0,
      y: 0,
    },
    planets: [],
    ...overrides,
  }
}

export function createGalaxyPlanetModelStub(overrides: Partial<GalaxyPlanetModel> = {}): GalaxyPlanetModel {
  return {
    id: branded<PlanetId>(1),
    ownerPlayerId: null,
    name: "planet",
    coordinates: "0:0:0",
    x: 0,
    y: 0,
    biome: PlanetBiome.OCEANIC,
    size: PlanetSize.SMALL,
    fertility: 1,
    metal: 1,
    fuel: 1,
    energy: 1,
    maxPopulation: 1,
    area: 1,
    ...overrides,
  }
}
