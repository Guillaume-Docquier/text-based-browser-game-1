import type { accountsTable } from "#lib/db/schema.ts"
import z from "zod"

export type AccountId = z.infer<typeof AccountId>
export const AccountId = z.string() satisfies z.ZodType<(typeof accountsTable.$inferSelect)["id"]>
