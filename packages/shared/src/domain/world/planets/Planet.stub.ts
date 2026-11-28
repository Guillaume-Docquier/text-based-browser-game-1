import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { PlanetSchema, type Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "#shared/domain/world/planets/PlanetSize.ts"

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
    metalProduction: 0,
    remainingMetalDeposit: 0,
    area: 1,
    ...overrides,
  })
}
