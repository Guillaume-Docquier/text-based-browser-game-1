import type { Enumify } from "@guillaume-docquier/tools-ts"

/** A Planet biome, which determines its resource Attribute ranges. */
export type PlanetBiome = Enumify<typeof PlanetBiome>
export const PlanetBiome = {
  OCEANIC: "OCEANIC",
  METALLIC: "METALLIC",
  FROZEN: "FROZEN",
  VOLCANIC: "VOLCANIC",
} as const
