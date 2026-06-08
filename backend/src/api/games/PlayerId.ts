import { type gamePlayersTable } from "#lib/db/schema.ts"
import z from "zod"

export type PlayerId = z.infer<typeof PlayerId>
export const PlayerId = z.string() satisfies z.ZodType<(typeof gamePlayersTable.$inferSelect)["playerId"]>
