import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { validateTarget } from "#game-rules/action-submission/validation/validators/validateTarget.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

describe("validateTarget", () => {
  it("should check a resolved target using its slot definition and submitting player", () => {
    const playerId = branded<PlayerId>("submitting-player")
    const targetDefinition = { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] }

    expect(validateTarget({ type: TargetType.PLANET, ownerPlayerId: playerId }, playerId, targetDefinition)).toBeNull()
    expect(validateTarget({ type: TargetType.PLANET, ownerPlayerId: null }, playerId, targetDefinition)).toBe(
      "Expected target planet to be owned by the submitting player.",
    )
  })

  it("should reject a target with the wrong type for its slot", () => {
    const playerId = branded<PlayerId>("submitting-player")

    expect(
      validateTarget({ type: TargetType.FLEET, ownerPlayerId: playerId }, playerId, { targetType: TargetType.PLANET, constraints: [] }),
    ).toBe("Expected a PLANET target, received FLEET")
  })
})
