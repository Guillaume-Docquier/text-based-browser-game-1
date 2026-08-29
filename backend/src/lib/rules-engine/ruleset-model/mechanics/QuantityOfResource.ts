import { z } from "zod"
import { ResourceTypeSchema, type ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

export type QuantityOfResource = {
  /**
   * Expected to be a positive non-zero number, often times an integer, but not always.
   */
  quantity: number
  /**
   * Expected to match a resource available in the current ruleset.
   */
  resourceType: ResourceType
}

export const QuantityOfResourceSchema = z.object({
  quantity: z.number(),
  resourceType: ResourceTypeSchema,
})
