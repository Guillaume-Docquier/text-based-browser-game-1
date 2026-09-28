import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { text } from "drizzle-orm/pg-core"
import { z } from "zod"

/**
 * The identifier of an Action Definition.
 */
export type ActionDefinitionId = Branded<"ActionDefinitionId", string>
export const ActionDefinitionIdSchema = z.string().transform(branded<ActionDefinitionId>) satisfies z.ZodType<ActionDefinitionId>

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionDefinitionIdColumn = (name: string) => text(name).$type<ActionDefinitionId>()
