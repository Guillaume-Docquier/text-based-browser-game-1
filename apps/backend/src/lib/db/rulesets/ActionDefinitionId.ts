import { varchar } from "drizzle-orm/pg-core"
import { ACTION_DEFINITION_ID_MAX_LENGTH, type ActionDefinitionId } from "game-rules/models/ActionDefinitionId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionDefinitionIdColumn = (name: string) =>
  varchar(name, { length: ACTION_DEFINITION_ID_MAX_LENGTH }).$type<ActionDefinitionId>()
