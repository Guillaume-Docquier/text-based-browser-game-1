import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { varchar } from "drizzle-orm/pg-core"
import { z } from "zod"

const MAX_LENGTH = 36

/**
 * The identifier of an Action Definition.
 */
export type ActionDefinitionId = Branded<"ActionDefinitionId", string>
export const ActionDefinitionIdSchema = z
  .string()
  .min(1)
  .max(MAX_LENGTH)
  .transform(branded<ActionDefinitionId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionDefinitionIdColumn = (name: string) => varchar(name, { length: MAX_LENGTH }).$type<ActionDefinitionId>()
