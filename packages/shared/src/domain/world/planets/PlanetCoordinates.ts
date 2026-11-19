import { z } from "zod"

export type PlanetCoordinates = string
export const PlanetCoordinatesSchema = z.string() satisfies z.ZodType<PlanetCoordinates>
