import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { integer } from "drizzle-orm/pg-core"
import { z } from "zod"

export type StarId = Branded<number, "StarId">
export const StarId = z.number().transform(branded<StarId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const starIdColumn = (name: string) => integer(name).$type<StarId>()
