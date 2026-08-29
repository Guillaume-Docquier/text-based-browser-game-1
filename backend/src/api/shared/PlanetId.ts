import { z } from "zod"
import { type planetsTable } from "#lib/db/schema.ts"

export type PlanetId = z.infer<typeof PlanetId>
export const PlanetId = z.number() satisfies z.ZodType<(typeof planetsTable.$inferSelect)["id"]>
