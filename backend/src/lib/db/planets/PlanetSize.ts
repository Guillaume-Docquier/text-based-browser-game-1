import type { Enumify } from "@guillaume-docquier/tools-ts"
import { pgEnum } from "drizzle-orm/pg-core"
import { pgEnumify } from "#lib/db/pgEnumify.ts"

/** A Planet Size, which determines its Max Population and Area ranges. */
export type PlanetSize = Enumify<typeof PlanetSize>
export const PlanetSize = {
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
} as const

export const planetSizeColumn = pgEnum("planet_size", pgEnumify(PlanetSize))
