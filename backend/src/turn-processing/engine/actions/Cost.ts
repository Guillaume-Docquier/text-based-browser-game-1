import { type ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"

export type Cost = {
  /**
   * Expected to match a resource available in the current ruleset
   */
  resourceType: ResourceType
  /**
   * Expected to be a positive non-zero integer
   */
  quantity: number
}
