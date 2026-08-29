import { z } from "zod"
import type { accountsTable } from "#lib/db/schema.ts"

export type AccountId = z.infer<typeof AccountId>
export const AccountId = z.string() satisfies z.ZodType<(typeof accountsTable.$inferSelect)["id"]>
