import { describe, expect, it } from "vitest"
import { FleetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"
import { PlanetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"
import { createTargetDefinitionStub } from "#shared/domain/ruleset/target-definitions/TargetDefinition.stub.ts"
import { TargetDefinitionSchema } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

describe("TargetDefinitionSchema", () => {
  it("should accept fleet ownership constraints as an array", () => {
    // Arrange
    const definition = createTargetDefinitionStub({
      targetType: TargetType.FLEET,
      constraints: [FleetOwnedBySubmittingPlayerConstraint.create(), FleetOwnedBySubmittingPlayerConstraint.create()],
    })

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result).toMatchObject({ success: true, data: definition })
  })

  it("should accept planet ownership constraints as an array", () => {
    // Arrange
    const definition = createTargetDefinitionStub({
      targetType: TargetType.PLANET,
      constraints: [PlanetOwnedBySubmittingPlayerConstraint.create(), PlanetOwnedBySubmittingPlayerConstraint.create()],
    })

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result).toMatchObject({ success: true, data: definition })
  })

  it.each([TargetType.FLEET, TargetType.PLANET, TargetType.PLAYER])(
    "should accept an empty constraint array for %s targets",
    (targetType) => {
      // Arrange
      const definition = { targetType, constraints: [] }

      // Act
      const result = TargetDefinitionSchema.safeParse(definition)

      // Assert
      expect(result).toMatchObject({ success: true, data: definition })
    },
  )

  it.each([TargetType.FLEET, TargetType.PLANET, TargetType.PLAYER])("should reject an unknown constraint for %s targets", (targetType) => {
    // Arrange
    const definition = { targetType, constraints: [{ type: "UNSUPPORTED", references: {}, parameters: {} }] }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.success).toBe(false)
  })

  it("should reject fleet ownership on player targets", () => {
    // Arrange
    const definition = { targetType: TargetType.PLAYER, constraints: [FleetOwnedBySubmittingPlayerConstraint.create()] }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.success).toBe(false)
  })

  it("should reject planet ownership on player targets", () => {
    // Arrange
    const definition = { targetType: TargetType.PLAYER, constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()] }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.success).toBe(false)
  })

  it("should reject any nonempty player constraint array", () => {
    // Arrange
    const definition = { targetType: TargetType.PLAYER, constraints: [{}] }

    // Act
    const result = TargetDefinitionSchema.safeParse(definition)

    // Assert
    expect(result.success).toBe(false)
  })
})
