import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { integer } from "drizzle-orm/pg-core"
import { z } from "zod"

export type GameId = Branded<number, "GameId">
export const GameId = z.number().transform(branded<GameId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const gameIdColumn = (name: string) => integer(name).$type<GameId>()
