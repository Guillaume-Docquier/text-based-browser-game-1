import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type GameId = Branded<"GameId", number>
export const GameIdSchema = z.number().transform(branded<GameId>)
