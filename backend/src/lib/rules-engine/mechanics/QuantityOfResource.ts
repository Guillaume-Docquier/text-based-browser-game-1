import { type ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"

export type QuantityOfResource = {
  /**
   * Expected to be a positive non-zero number, often times an integer, but not always.
   */
  readonly quantity: number
  /**
   * Expected to match a resource available in the current ruleset.
   */
  readonly resourceType: ResourceType
}
