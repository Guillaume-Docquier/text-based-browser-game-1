import { z } from "zod"
import { type playersTable } from "#lib/db/schema.ts"

export type PlayerId = z.infer<typeof PlayerId>
export const PlayerId = z.string() satisfies z.ZodType<(typeof playersTable.$inferSelect)["playerId"]>
