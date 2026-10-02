import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type Alias = Branded<"Alias", string>
export const AliasSchema = z
  .string()
  .trim()
  .min(1)
  .max(36)
  .refine((alias) => !alias.includes("\0"), { error: "Alias cannot contain null characters." })
  .transform(branded<Alias>)
