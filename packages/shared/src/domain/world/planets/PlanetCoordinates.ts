import { z } from "zod"

/**
 * Planet coordinates go from 00:00:00 to 99:99:49
 * The first 2 segments are the star coordinates
 * The last segment is the orbit coordinates
 */
export type PlanetCoordinates = string
export const PlanetCoordinatesSchema = z.string() satisfies z.ZodType<PlanetCoordinates>
