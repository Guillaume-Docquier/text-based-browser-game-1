import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const ACTION_ID_MAX_LENGTH = 36

export type ActionId = Branded<"ActionId", string>
export const ActionIdSchema = z
  .string()
  .min(1)
  .max(ACTION_ID_MAX_LENGTH)
  .transform(branded<ActionId>)
