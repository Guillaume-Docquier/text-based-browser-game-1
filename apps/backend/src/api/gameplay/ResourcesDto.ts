import { ResourceTypeSchema } from "shared/domain/resources/ResourceType.ts"
import { z } from "zod"

export type ResourceAmountsDto = z.infer<typeof ResourceAmountsDtoSchema>
const ResourceAmountsDtoSchema = z.object({
  /**
   * Resources that can be used this turn on more actions.
   */
  uncommitted: z.number(),
  /**
   * All resources that are available this turn, including those already committed to actions.
   */
  total: z.number(),
})

export type ResourcesDto = z.infer<typeof ResourcesDtoSchema>
export const ResourcesDtoSchema = z.record(ResourceTypeSchema, ResourceAmountsDtoSchema)
