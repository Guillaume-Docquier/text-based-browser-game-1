import { describe, expect, it } from "vitest"
import { QuantityOfResourceSchema } from "#shared/domain/resources/QuantityOfResource.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { ActionSchema } from "#shared/domain/turns/actions/Action.ts"
import { ActionIdSchema } from "#shared/domain/turns/actions/ActionId.ts"

describe("ActionSchema", () => {
  it("should preserve an available action", () => {
    // Arrange
    const action = createAvailableActionStub()

    // Act
    const result = ActionSchema.safeParse(action)

    // Assert
    expect(result).toStrictEqual({ success: true, data: action })
  })

  it("should preserve a submitted action and its selected targets", () => {
    // Arrange
    const action = createSubmittedActionStub({ selectedTargets: { planet: "planet-1" } })

    // Act
    const result = ActionSchema.safeParse(action)

    // Assert
    expect(result).toStrictEqual({ success: true, data: action })
  })
})

describe("constrained domain scalar schemas", () => {
  it.each([0, -1])("should reject a non-positive resource quantity: %s", (quantity) => {
    // Arrange
    const input = { quantity, resourceType: ResourceType.INFLUENCE }

    // Act
    const result = QuantityOfResourceSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
  })

  it("should reject an action id containing a null character", () => {
    // Arrange
    const invalidId = "action\0id"

    // Act
    const result = ActionIdSchema.safeParse(invalidId)

    // Assert
    expect(result.success).toBe(false)
  })
})
