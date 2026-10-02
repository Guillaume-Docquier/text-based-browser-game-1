import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type FleetId = Branded<"FleetId", string>
export const FleetIdSchema = z.string().transform(branded<FleetId>) satisfies z.ZodType<FleetId>
