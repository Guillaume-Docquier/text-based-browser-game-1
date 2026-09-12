import { describe, expect, it } from "vitest"
import { targetTypeSatisfies, TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

describe("targetTypeSatisfies", () => {
  it.each([
    [{ provided: TargetType.PLANET, required: TargetType.PLANET }, true],
    [{ provided: TargetType.PLANET_OWNED, required: TargetType.PLANET }, true],
    [{ provided: TargetType.PLANET, required: TargetType.PLANET_OWNED }, false],
    [{ provided: TargetType.FLEET, required: TargetType.PLANET }, false],
    [{ provided: TargetType.PLANET, required: TargetType.FLEET }, false],
  ])("should report whether %s satisfies %s", ({ provided, required }, expected) => {
    // Act
    const result = targetTypeSatisfies({ provided, required })

    // Assert
    expect(result).toBe(expected)
  })
})
