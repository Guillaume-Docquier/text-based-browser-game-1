import { varchar } from "drizzle-orm/pg-core"
import { ACTION_ID_MAX_LENGTH, type ActionId } from "shared/domain/actions/ActionId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionIdColumn = (name: string) => varchar(name, { length: ACTION_ID_MAX_LENGTH }).$type<ActionId>()
