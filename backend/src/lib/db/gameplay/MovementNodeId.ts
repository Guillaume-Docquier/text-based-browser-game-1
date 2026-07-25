import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import z from "zod"

/**
 * Stable identity of a Sector or Body that can be used as a movement node.
 */
export type MovementNodeId = Branded<string, "MovementNodeId">

/**
 * Parses a serialized movement-node identity.
 */
export const MovementNodeId = z.string().transform(branded<MovementNodeId>)
