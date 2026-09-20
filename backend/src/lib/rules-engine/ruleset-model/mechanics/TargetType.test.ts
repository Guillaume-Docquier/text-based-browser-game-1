import { describe, expect, it } from "vitest"
import { ActionTargetDefinitionSchema } from "#lib/rules-engine/ruleset-model/actions/ActionTargetDefinition.ts"
import { TargetType, TargetTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

describe("TargetType", () => {
  it("should contain exactly the supported base target types", () => {
    // Act
    const targetTypes = Object.values(TargetType)

    // Assert
    expect(targetTypes).toStrictEqual(["FLEET", "PLANET", "PLAYER"])
  })

  it("should reject the removed PLANET_OWNED subtype", () => {
    // Act
    const parsedTargetType = TargetTypeSchema.safeParse("PLANET_OWNED")

    // Assert
    expect(parsedTargetType.success).toBe(false)
  })

  it("should reject the former scalar Action target shape", () => {
    // Act
    const parsedTargetDefinition = ActionTargetDefinitionSchema.safeParse(TargetType.PLANET)

    // Assert
    expect(parsedTargetDefinition.success).toBe(false)
  })
})
