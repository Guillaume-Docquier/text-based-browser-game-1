import { z } from "zod"
import { type planetsTable } from "#lib/db/schema.ts"

/**
 * Planet coordinates go from 00:00:00 to 99:99:49
 * The first 2 segments are the star coordinates
 * The last segment is the orbit coordinates
 */
export type PlanetCoordinates = z.infer<typeof PlanetCoordinates>
export const PlanetCoordinates = z.string() satisfies z.ZodType<(typeof planetsTable.$inferSelect)["coordinates"]>
