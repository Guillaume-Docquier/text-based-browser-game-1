import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { MovementNodeId } from "#lib/db/gameplay/MovementNodeId.ts"

/**
 * The concrete Star System entity represented by a movement node.
 */
export type MovementNodeType = Enumify<typeof MovementNodeType>
export const MovementNodeType = {
  SECTOR: "SECTOR",
  BODY: "BODY",
} as const

/**
 * A concrete Star System location that gameplay state can reference.
 */
export type MovementNode = {
  readonly nodeType: MovementNodeType
  readonly nodeId: MovementNodeId
}
