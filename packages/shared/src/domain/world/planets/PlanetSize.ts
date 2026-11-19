import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type PlanetSize = Enumify<typeof PlanetSize>
export const PlanetSize = {
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
} as const

export const PlanetSizeSchema = z.enum(PlanetSize) satisfies z.ZodType<PlanetSize>
