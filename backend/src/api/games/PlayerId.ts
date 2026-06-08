import { type playersTable } from "#lib/db/schema.ts"
import z from "zod"

export type PlayerId = z.infer<typeof PlayerId>
export const PlayerId = z.string() satisfies z.ZodType<(typeof playersTable.$inferSelect)["playerId"]>
