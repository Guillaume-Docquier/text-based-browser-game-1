import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const PLANET_NAME_MAX_LENGTH = 36

export type PlanetName = Branded<"PlanetName", string>
export const PlanetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANET_NAME_MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Planet name cannot contain null characters." })
  .transform(branded<PlanetName>) satisfies z.ZodType<PlanetName>
