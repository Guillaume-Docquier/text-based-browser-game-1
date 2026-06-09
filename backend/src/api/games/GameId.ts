import { z } from "zod"
import type { gamesTable } from "#lib/db/schema.ts"

export type GameId = z.infer<typeof GameId>
export const GameId = z.number() satisfies z.ZodType<(typeof gamesTable.$inferSelect)["id"]>
