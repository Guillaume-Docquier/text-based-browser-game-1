import { describe, expect, it } from "vitest"
import { z } from "zod"
import { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

describe("EffectDefinitionTargetDefinition.schemaFor", () => {
  const PlanetTargetDefinitionSchema = EffectDefinitionTargetDefinition.schemaFor(z.literal(TargetType.PLANET))

  it("should accept the target type selected by the narrow schema", () => {
    // Arrange
    const input = { actionTargetTag: "planet", targetType: TargetType.PLANET }

    // Act
    const result = PlanetTargetDefinitionSchema.safeParse(input)

    // Assert
    expect(result).toStrictEqual({ success: true, data: input })
  })

  it("should reject a different target type", () => {
    // Arrange
    const input = { actionTargetTag: "planet", targetType: TargetType.FLEET }

    // Act
    const result = PlanetTargetDefinitionSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
  })
})
