import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const ACTION_DEFINITION_ID_MAX_LENGTH = 36

export type ActionDefinitionId = Branded<"ActionDefinitionId", string>
export const ActionDefinitionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(ACTION_DEFINITION_ID_MAX_LENGTH)
  .refine((name) => !name.includes("\0"), { error: "Action Definition Id cannot contain null characters." })
  .transform(branded<ActionDefinitionId>)
