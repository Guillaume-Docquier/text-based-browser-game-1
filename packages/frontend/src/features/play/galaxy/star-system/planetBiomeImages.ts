import type { PlanetBiome } from "@api-types"
import frozen from "@/assets/planets/frozen-small.png"
import metallic from "@/assets/planets/metallic-small.png"
import oceanic from "@/assets/planets/oceanic-small.png"
import volcanic from "@/assets/planets/volcanic-small.png"

/**
 * Planet artwork by Biome. Each image is scaled to the Planet's configured size.
 */
export const PLANET_BIOME_IMAGES = {
  OCEANIC: oceanic,
  METALLIC: metallic,
  FROZEN: frozen,
  VOLCANIC: volcanic,
} as const satisfies Record<PlanetBiome, string>
