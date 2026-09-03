import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** The identifier of a star within a game. */
export type StarId = Branded<number, "StarId">

/** Parses a number as a star identifier. */
export const StarId = z.number().transform(branded<StarId>)
