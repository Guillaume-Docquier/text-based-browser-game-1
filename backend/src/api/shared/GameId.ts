import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** The identifier of a game. */
export type GameId = Branded<number, "GameId">

/** Parses a number as a game identifier. */
export const GameId = z.number().transform(branded<GameId>)
