import { z } from "zod"

export type OrbitCoordinates = string
export const OrbitCoordinatesSchema = z.string() satisfies z.ZodType<OrbitCoordinates>
