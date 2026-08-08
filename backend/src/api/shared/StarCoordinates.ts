import { z } from "zod"
import { type starsTable } from "#lib/db/schema.ts"

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export type StarCoordinates = z.infer<typeof StarCoordinates>
export const StarCoordinates = z.string() satisfies z.ZodType<(typeof starsTable.$inferSelect)["coordinates"]>
