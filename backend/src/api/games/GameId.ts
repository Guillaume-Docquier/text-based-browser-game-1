import type { gamesTable } from "#lib/db/schema.ts"
import { z } from "zod"

export type GameId = z.infer<typeof GameId>
export const GameId = z.number() satisfies z.ZodType<(typeof gamesTable.$inferSelect)["id"]>
