import { describe, expect, it } from "vitest"
import { targetTypeSatisfies, TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

describe("targetTypeSatisfies", () => {
  it.each([
    [TargetType.PLANET, TargetType.PLANET, true],
    [TargetType.PLANET_OWNED, TargetType.PLANET, true],
    [TargetType.PLANET, TargetType.PLANET_OWNED, false],
    [TargetType.FLEET, TargetType.PLANET, false],
  ])("should report whether %s satisfies %s", (targetType, requiredTargetType, expected) => {
    // Act
    const result = targetTypeSatisfies(targetType, requiredTargetType)

    // Assert
    expect(result).toBe(expected)
  })
})
