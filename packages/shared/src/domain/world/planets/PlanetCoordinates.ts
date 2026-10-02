import { z } from "zod"

/**
 * Planet coordinates are composed of the containing Star coordinates and an
 * orbit coordinate.
 */
export type PlanetCoordinates = string
export const PlanetCoordinatesSchema = z.string() satisfies z.ZodType<PlanetCoordinates>
