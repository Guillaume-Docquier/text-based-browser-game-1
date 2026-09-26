import { describe, expect, it } from "vitest"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetDefinitionSchema } from "#lib/rules-engine/ruleset/target-constraints/TargetDefinition.ts"

describe("ActionTargetDefinitionSchema", () => {
  it.each([TargetType.FLEET, TargetType.PLANET])("should accept an ownership constraint for %s targets", (targetType) => {
    // Arrange
    const definition = {
      targetType,
      constraints: [OwnedBySubmittingPlayerConstraint.create()],
    }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.success).toBe(true)
  })

  it("should reject an ownership constraint for player targets", () => {
    // Arrange
    const definition = {
      targetType: TargetType.PLAYER,
      constraints: [OwnedBySubmittingPlayerConstraint.create()],
    }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.error?.issues).toStrictEqual([
      {
        code: "custom",
        path: ["constraints", 0],
        message: `Constraint "${OwnedBySubmittingPlayerConstraint.type}" does not support target type "${TargetType.PLAYER}"`,
      },
    ])
  })
})
