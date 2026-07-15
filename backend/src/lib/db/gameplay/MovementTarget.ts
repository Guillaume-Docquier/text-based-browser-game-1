import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { MovementTargetId } from "#lib/db/gameplay/MovementTargetId.ts"

/**
 * The concrete Star System entity represented by a movement target.
 */
export type MovementTargetType = Enumify<typeof MovementTargetType>
export const MovementTargetType = {
  SECTOR: "SECTOR",
  BODY: "BODY",
} as const

/**
 * A concrete Star System location that gameplay state can reference.
 */
export type MovementTarget = {
  readonly targetType: MovementTargetType
  readonly targetId: MovementTargetId
}
