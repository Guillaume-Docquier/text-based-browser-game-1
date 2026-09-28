import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { text } from "drizzle-orm/pg-core"
import { z } from "zod"

export type StarId = Branded<"StarId", string>
export const StarIdSchema = z.string().transform(branded<StarId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const starIdColumn = (name: string) => text(name).$type<StarId>()
