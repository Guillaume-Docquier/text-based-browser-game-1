import { Result } from "@guillaume-docquier/tools-ts"
import { QuantityOfResourceSchema } from "#shared/domain/resources/QuantityOfResource.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"

/**
 * The same resource-spending mechanic handles action costs and composed spending.
 */
export const spendResources = defineMechanic({
  targets: {},
  parameters: QuantityOfResourceSchema.unwrap().strict().readonly(),
  phase: "payCosts",
  requirements: () => [],
  resourceSpending: (parameters) => [parameters],
  resolve: (_targets, parameters, { actor }) => {
    if (actor.resources[parameters.resourceType] < parameters.quantity) {
      return Result.Failure([{ path: ["costs", parameters.resourceType], message: "Insufficient resources" }])
    }
    actor.resources[parameters.resourceType] -= parameters.quantity
    return Result.Success([{ status: "resolved", message: `Spent ${parameters.quantity} ${parameters.resourceType}` }])
  },
})
