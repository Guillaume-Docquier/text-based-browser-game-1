import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import z from "zod"

/**
 * Stable identity of a Sector or Body that can be used as a movement target.
 */
export type MovementTargetId = Branded<string, "MovementTargetId">

/**
 * Parses a serialized movement-target identity.
 */
export const MovementTargetId = z.string().transform(branded<MovementTargetId>)
