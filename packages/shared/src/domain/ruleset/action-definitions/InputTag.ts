import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * The key of an Action Definition input slot.
 */
export type InputTag = Branded<"InputTag", string>
export const InputTagSchema = z.string().transform(branded<InputTag>) satisfies z.ZodType<InputTag>
