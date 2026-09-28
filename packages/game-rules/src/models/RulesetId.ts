import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type RulesetId = Branded<"RulesetId", string>
export const RulesetIdSchema = z.string().transform(branded<RulesetId>)
