import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type Integer = Branded<"Integer", number>

export const IntegerSchema = z.int().transform(branded<Integer>)
