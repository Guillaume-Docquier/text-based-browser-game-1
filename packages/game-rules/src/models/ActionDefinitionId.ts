import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const ACTION_DEFINITION_ID_MAX_LENGTH = 36

/**
 * The identifier of an Action Definition.
 */
export type ActionDefinitionId = Branded<"ActionDefinitionId", string>
export const ActionDefinitionIdSchema = z
  .string()
  .min(1)
  .max(ACTION_DEFINITION_ID_MAX_LENGTH)
  .transform(branded<ActionDefinitionId>)
