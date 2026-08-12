import { type ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"

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
