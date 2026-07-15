import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import z from "zod"

/**
 * Stable identity of a Unit in a game.
 */
export type UnitId = Branded<string, "UnitId">

/**
 * Parses a serialized Unit identity.
 */
export const UnitId = z.string().transform((value) => branded<UnitId>(value))
