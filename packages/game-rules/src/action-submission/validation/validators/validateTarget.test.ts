import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { validateTarget } from "#game-rules/action-submission/validation/validators/validateTarget.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

describe("validateTarget", () => {
  it("should accept a target owned by the submitting player", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] }
    const ownedPlanetTarget = { type: TargetType.PLANET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = validateTarget({ target: ownedPlanetTarget, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBeNull()
  })

  it("should reject a target not owned by the submitting player", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] }
    const unclaimedPlanetTarget = { type: TargetType.PLANET, ownerPlayerId: null }

    // Act
    const result = validateTarget({ target: unclaimedPlanetTarget, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected target planet to be owned by the submitting player.")
  })

  it("should reject a target with the wrong type for its slot", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = { targetType: TargetType.PLANET, constraints: [] }
    const ownedFleetTarget = { type: TargetType.FLEET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = validateTarget({ target: ownedFleetTarget, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected a PLANET target, received FLEET")
  })
})
