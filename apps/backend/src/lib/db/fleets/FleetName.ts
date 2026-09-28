import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { varchar } from "drizzle-orm/pg-core"
import { z } from "zod"

export type FleetName = Branded<"FleetName", string>

const MAX_LENGTH = 36

export const FleetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Fleet name cannot contain null characters." })
  .transform(branded<FleetName>) satisfies z.ZodType<FleetName>

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const fleetNameColumn = (name: string) => varchar(name, { length: MAX_LENGTH }).$type<FleetName>()
