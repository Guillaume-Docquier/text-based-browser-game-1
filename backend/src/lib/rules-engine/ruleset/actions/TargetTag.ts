import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * A tag for a target submission. This is used by mechanics to resolve their required targets.
 */
export type TargetTag = Branded<"TargetTag", string>
export const TargetTagSchema = z.string().transform(branded<TargetTag>)
