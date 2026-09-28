import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const ACTION_ID_MAX_LENGTH = 36

export type ActionId = Branded<"ActionId", string>
export const ActionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(ACTION_ID_MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Action Id cannot contain null characters." })
  .transform(branded<ActionId>)
