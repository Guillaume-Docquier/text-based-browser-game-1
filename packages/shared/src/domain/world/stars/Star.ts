import { z } from "zod"
import { StarCoordinatesSchema, type StarCoordinates } from "#shared/domain/world/stars/StarCoordinates.ts"
import { StarIdSchema, type StarId } from "#shared/domain/world/stars/StarId.ts"

export type Star = {
  readonly id: StarId
  readonly name: string
  readonly coordinates: StarCoordinates
  readonly x: number
  readonly y: number
}

export const StarSchema = z.object({
  id: StarIdSchema,
  name: z.string(),
  coordinates: StarCoordinatesSchema,
  x: z.number(),
  y: z.number(),
}) satisfies z.ZodType<Star>
