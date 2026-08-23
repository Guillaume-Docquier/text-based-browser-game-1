import { z } from "zod"
import { ResourceTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

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
