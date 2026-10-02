import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** A Planet biome, which determines its resource Attribute ranges. */
export type PlanetBiome = Enumify<typeof PlanetBiome>
export const PlanetBiome = {
  OCEANIC: "OCEANIC",
  METALLIC: "METALLIC",
  FROZEN: "FROZEN",
  VOLCANIC: "VOLCANIC",
} as const

export const PlanetBiomeSchema = z.enum(PlanetBiome) satisfies z.ZodType<PlanetBiome>
