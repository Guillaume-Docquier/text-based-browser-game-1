import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * The key of an Action Definition target slot. Effect Definitions use it to look up selected target ids in Action Submissions.
 */
export type TargetTag = Branded<"TargetTag", string>
export const TargetTagSchema = z.string().transform(branded<TargetTag>) satisfies z.ZodType<TargetTag>
