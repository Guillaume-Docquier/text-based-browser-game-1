import { z } from "zod"
import { PlanetSchema, type Planet } from "#shared/domain/world/planets/Planet.ts"
import { StarSchema, type Star } from "#shared/domain/world/stars/Star.ts"

export type StarSystem = Readonly<{
  star: Star
  planets: readonly Planet[]
}>

export const StarSystemSchema = z.object({
  star: StarSchema,
  planets: z.array(PlanetSchema),
}) satisfies z.ZodType<StarSystem>
