import { z } from "zod"
import { StarSystemSchema, type StarSystem } from "#shared/domain/world/StarSystem.ts"

export type Galaxy = {
  readonly systems: readonly StarSystem[]
}

export const GalaxySchema = z.object({
  systems: z.array(StarSystemSchema),
}) satisfies z.ZodType<Galaxy>
