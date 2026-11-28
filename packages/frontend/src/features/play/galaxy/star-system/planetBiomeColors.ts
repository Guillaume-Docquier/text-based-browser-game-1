import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"

export const PLANET_BIOME_COLORS = {
  [PlanetBiome.GAS]: "#a68ad0",
  [PlanetBiome.OCEANIC]: "#3452eb",
  [PlanetBiome.METALLIC]: "#798391",
  [PlanetBiome.FROZEN]: "#ffffff",
  [PlanetBiome.VOLCANIC]: "#f97316",
} as const satisfies Record<PlanetBiome, `#${string}`>
