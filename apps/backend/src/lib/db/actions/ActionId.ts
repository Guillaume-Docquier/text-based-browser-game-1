import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { varchar } from "drizzle-orm/pg-core"
import { z } from "zod"

const MAX_LENGTH = 36

export type ActionId = Branded<"ActionId", string>
export const ActionIdSchema = z
  .string()
  .min(1)
  .max(MAX_LENGTH)
  .transform(branded<ActionId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const actionIdColumn = (name: string) => varchar(name, { length: MAX_LENGTH }).$type<ActionId>()
