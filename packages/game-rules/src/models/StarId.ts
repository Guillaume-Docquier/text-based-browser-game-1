import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type StarId = Branded<"StarId", string>
export const StarIdSchema = z.string().transform(branded<StarId>)
