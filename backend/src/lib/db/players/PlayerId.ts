import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { uuid } from "drizzle-orm/pg-core"
import { z } from "zod"

export type PlayerId = Branded<string, "PlayerId">
export const PlayerId = z.string().transform(branded<PlayerId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const playerIdColumn = (name: string) => uuid(name).$type<PlayerId>()
