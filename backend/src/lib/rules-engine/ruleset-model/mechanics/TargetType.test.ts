import { describe, expect, it } from "vitest"
import {
  TargetCondition,
  targetRequirementSatisfies,
  TargetRequirementSchema,
  TargetType,
} from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

describe("targetRequirementSatisfies", () => {
  it.each([
    [
      {
        provided: { type: TargetType.PLANET, conditions: [] },
        required: { type: TargetType.PLANET, conditions: [] },
      },
      true,
    ],
    [
      {
        provided: { type: TargetType.PLANET, conditions: [TargetCondition.OWNED] },
        required: { type: TargetType.PLANET, conditions: [] },
      },
      true,
    ],
    [
      {
        provided: { type: TargetType.PLANET, conditions: [] },
        required: { type: TargetType.PLANET, conditions: [TargetCondition.OWNED] },
      },
      false,
    ],
    [
      {
        provided: { type: TargetType.FLEET, conditions: [] },
        required: { type: TargetType.PLANET, conditions: [] },
      },
      false,
    ],
  ])("should report whether %s satisfies %s", ({ provided, required }, expected) => {
    // Act
    const result = targetRequirementSatisfies({ provided, required })

    // Assert
    expect(result).toBe(expected)
  })

  it("should reject ownership conditions for targets that cannot be owned", () => {
    // Act
    const result = TargetRequirementSchema.safeParse({
      type: TargetType.PLAYER,
      conditions: [TargetCondition.OWNED],
    })

    // Assert
    expect(result.success).toBe(false)
  })
})
