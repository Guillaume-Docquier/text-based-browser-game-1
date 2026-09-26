import { describe, expect, it } from "vitest"
import { ActionTargetDefinitionSchema } from "#lib/rules-engine/ruleset/actions/ActionTargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

describe("ActionTargetDefinitionSchema", () => {
  it.each([TargetType.FLEET, TargetType.PLANET])("should accept an ownership constraint for %s targets", (targetType) => {
    // Arrange
    const definition = {
      targetType,
      constraints: [OwnedBySubmittingPlayerConstraint.create()],
    }

    // Act
    const result = ActionTargetDefinitionSchema.safeParse(definition)

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
    const result = ActionTargetDefinitionSchema.safeParse(definition)

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
