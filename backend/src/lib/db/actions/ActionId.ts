import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { uuid } from "drizzle-orm/pg-core"
import { z } from "zod"

export type ActionId = Branded<string, "ActionId">
export const ActionId = z.string().transform(branded<ActionId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionIdColumn = (name: string) => uuid(name).$type<ActionId>()
