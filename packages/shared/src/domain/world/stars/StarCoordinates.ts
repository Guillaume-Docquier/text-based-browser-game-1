import { z } from "zod"

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
export type StarCoordinates = string
export const StarCoordinatesSchema = z.string() satisfies z.ZodType<StarCoordinates>
