import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import frozen from "@/assets/planets/frozen-small.png"
import metallic from "@/assets/planets/metallic-small.png"
import oceanic from "@/assets/planets/oceanic-small.png"
import volcanic from "@/assets/planets/volcanic-small.png"

export const PLANET_BIOME_IMAGES = {
  [PlanetBiome.OCEANIC]: oceanic,
  [PlanetBiome.METALLIC]: metallic,
  [PlanetBiome.FROZEN]: frozen,
  [PlanetBiome.VOLCANIC]: volcanic,
} as const satisfies Record<PlanetBiome, string>
