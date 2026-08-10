import type { PlanetBiome } from "@api-types"

/** Colors used to represent Planet Biomes across the Star System view. */
export const PLANET_BIOME_COLORS = {
  OCEANIC: "#3452eb",
  METALLIC: "#798391",
  FROZEN: "#ffffff",
  VOLCANIC: "#f97316",
} as const satisfies Record<PlanetBiome, `#${string}`>
