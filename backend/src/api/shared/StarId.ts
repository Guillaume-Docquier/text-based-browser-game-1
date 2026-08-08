import z from "zod"
import { type starsTable } from "#lib/db/schema.ts"

export type StarId = z.infer<typeof StarId>
export const StarId = z.number() satisfies z.ZodType<(typeof starsTable.$inferSelect)["id"]>
