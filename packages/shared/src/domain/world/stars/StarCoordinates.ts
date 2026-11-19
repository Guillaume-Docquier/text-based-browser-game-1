import { z } from "zod"

export type StarCoordinates = string
export const StarCoordinatesSchema = z.string() satisfies z.ZodType<StarCoordinates>
