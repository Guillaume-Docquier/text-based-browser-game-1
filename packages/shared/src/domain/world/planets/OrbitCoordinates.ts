import { z } from "zod"

/**
 * Distance in AU to the nearest star, padded with zeroes.
 */
export type OrbitCoordinates = string
export const OrbitCoordinatesSchema = z.string() satisfies z.ZodType<OrbitCoordinates>
