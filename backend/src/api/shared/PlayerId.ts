import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** The identifier of a player. */
export type PlayerId = Branded<string, "PlayerId">

/** Parses a string as a player identifier. */
export const PlayerId = z.string().transform(branded<PlayerId>)
