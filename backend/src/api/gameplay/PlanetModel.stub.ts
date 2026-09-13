import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import type { PlanetModel } from "./PlanetModel.ts"

export function createPlanetModelStub({
  id = 1,
  ownerPlayerId = null,
  ...overrides
}: Partial<UnbrandedProperties<PlanetModel>> = {}): PlanetModel {
  return {
    id: branded(id),
    ownerPlayerId: ownerPlayerId === null ? null : branded(ownerPlayerId),
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
