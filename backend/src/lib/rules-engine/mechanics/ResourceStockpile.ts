import { Assert, Result } from "@guillaume-docquier/tools-ts"
import type { QuantityOfResource } from "#lib/rules-engine/mechanics/QuantityOfResource.ts"
import type { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"

/**
 * The quantities of every Resource held by one player.
 */
export type ResourceStockpile = Record<ResourceType, number>

export type InsufficientResources = {
  readonly type: "INSUFFICIENT_RESOURCES"
  readonly resourceType: ResourceType
  readonly available: number
  readonly required: number
}

/**
 * Calculates and applies a collection of costs atomically to a new Resource Stockpile.
 * The input Stockpile is never mutated.
 */
export function trySpendResources(
  stockpile: ResourceStockpile,
  costs: readonly QuantityOfResource[],
): Result<ResourceStockpile, InsufficientResources> {
  const updatedStockpile = { ...stockpile }

  for (const cost of costs) {
    Assert.isTrue(Number.isFinite(cost.quantity) && cost.quantity > 0)
    const available = updatedStockpile[cost.resourceType]
    Assert.isDefined(available)

    if (available < cost.quantity) {
      return Result.Failure({
        type: "INSUFFICIENT_RESOURCES",
        resourceType: cost.resourceType,
        available,
        required: cost.quantity,
      })
    }

    updatedStockpile[cost.resourceType] = available - cost.quantity
  }

  return Result.Success(updatedStockpile)
}
