import type { Enumify } from "@guillaume-docquier/tools-ts"
import { pgEnum } from "drizzle-orm/pg-core"
import { pgEnumify } from "#lib/db/pgEnumify.ts"

/** A Planet biome, which determines its resource Attribute ranges. */
export type PlanetBiome = Enumify<typeof PlanetBiome>
export const PlanetBiome = {
  OCEANIC: "OCEANIC",
  METALLIC: "METALLIC",
  FROZEN: "FROZEN",
  VOLCANIC: "VOLCANIC",
} as const

export const planetBiomeColumn = pgEnum("planet_biome", pgEnumify(PlanetBiome))
