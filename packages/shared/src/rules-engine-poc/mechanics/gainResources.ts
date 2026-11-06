import { Result } from "@guillaume-docquier/tools-ts"
import { QuantityOfResourceSchema } from "#shared/domain/resources/QuantityOfResource.ts"
import { defineMechanic } from "../definitions/defineMechanic.ts"

/**
 * Grants a configured resource to the actor during Income.
 */
export const gainResources = defineMechanic({
  targets: {},
  parameters: QuantityOfResourceSchema.unwrap().strict().readonly(),
  phase: "income",
  requirements: () => [],
  resolve: (_targets, parameters, { actor }) => {
    actor.resources[parameters.resourceType] += parameters.quantity
    return Result.Success([{ status: "resolved", message: `Gained ${parameters.quantity} ${parameters.resourceType}` }])
  },
})
