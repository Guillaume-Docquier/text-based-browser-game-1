import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { QuantityOfResource } from "#shared/domain/resources/QuantityOfResource.ts"
import { QuantityOfResourceSchema } from "#shared/domain/resources/QuantityOfResource.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"

/**
 * Build a valid positive resource quantity for tests.
 */
export function createQuantityOfResourceStub({
  quantity = 1,
  resourceType = ResourceType.INFLUENCE,
  ...overrides
}: Partial<{ quantity: number; resourceType: QuantityOfResource["resourceType"] }> = {}): QuantityOfResource {
  return typedParse(QuantityOfResourceSchema, { quantity, resourceType, ...overrides })
}
