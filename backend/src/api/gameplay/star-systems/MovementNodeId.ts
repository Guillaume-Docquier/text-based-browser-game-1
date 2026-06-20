import { z } from "zod"
import { type movementNodesTable } from "#lib/db/schema.ts"

export type MovementNodeId = z.infer<typeof MovementNodeId>
export const MovementNodeId = z.string() satisfies z.ZodType<(typeof movementNodesTable.$inferSelect)["id"]>
