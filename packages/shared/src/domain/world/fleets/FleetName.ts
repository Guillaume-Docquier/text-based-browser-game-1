import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const FLEET_NAME_MAX_LENGTH = 36

export type FleetName = Branded<"FleetName", string>
export const FleetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(FLEET_NAME_MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Fleet name cannot contain null characters." })
  .transform(branded<FleetName>) satisfies z.ZodType<FleetName>
