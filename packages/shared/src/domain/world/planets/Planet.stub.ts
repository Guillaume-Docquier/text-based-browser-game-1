import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { PlanetSchema, type Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"

/**
 * Provides a unique id if none is specified
 */
export function createPlanetStub({
  id = v4(),
  ownerPlayerId = null,
  name = `planet-${id.slice(0, 8)}`,
  ...overrides
}: Partial<UnbrandedProperties<Planet>> = {}): Planet {
  return typedParse(PlanetSchema, {
    id,
    ownerPlayerId,
    name,
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
  })
}
