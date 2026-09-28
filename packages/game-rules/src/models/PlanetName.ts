import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** A non-empty Planet name of at most 36 characters. */
export type PlanetName = Branded<"PlanetName", string>

export const PLANET_NAME_MAX_LENGTH = 36

export const PlanetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANET_NAME_MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Planet name cannot contain null characters." })
  .transform(branded<PlanetName>) satisfies z.ZodType<PlanetName>
