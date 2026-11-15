import { ResourceTypeSchema } from "shared/domain/resources/ResourceType.ts"
import { z } from "zod"

export type PlayerViewResourceAmounts = z.infer<typeof PlayerViewResourceAmountsSchema>
const PlayerViewResourceAmountsSchema = z.object({
  /**
   * Resources that can be used this turn on more actions.
   */
  uncommitted: z.number(),
  /**
   * All resources that are available this turn, including those already committed to actions.
   */
  total: z.number(),
})

export type PlayerViewResources = z.infer<typeof PlayerViewResourcesSchema>
export const PlayerViewResourcesSchema = z.record(ResourceTypeSchema, PlayerViewResourceAmountsSchema)
