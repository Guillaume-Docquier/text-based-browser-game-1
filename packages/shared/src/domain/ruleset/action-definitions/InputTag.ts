import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
export type InputTag = Branded<"InputTag", string>
export const InputTagSchema = z.string().transform(branded<InputTag>) satisfies z.ZodType<InputTag>
