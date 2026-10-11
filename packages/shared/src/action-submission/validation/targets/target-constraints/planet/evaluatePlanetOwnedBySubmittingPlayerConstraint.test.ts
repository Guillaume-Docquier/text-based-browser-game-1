import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { evaluatePlanetOwnedBySubmittingPlayerConstraint } from "#shared/action-submission/validation/targets/target-constraints/planet/evaluatePlanetOwnedBySubmittingPlayerConstraint.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { PlanetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

describe("evaluatePlanetOwnedBySubmittingPlayerConstraint", () => {
  it("should accept a planet owned by the submitting player", () => {
    // Arrange
    const constraint = PlanetOwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const target = { type: TargetType.PLANET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = evaluatePlanetOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

    // Assert
    expect(result).toBeUndefined()
  })

  it("should report a planet owned by another player", () => {
    // Arrange
    const constraint = PlanetOwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const target = { type: TargetType.PLANET, ownerPlayerId: branded<PlayerId>("other-player") }

    // Act
    const result = evaluatePlanetOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

    // Assert
    expect(result).toBe("Expected target planet to be owned by the submitting player.")
  })

  it("should report an unowned planet", () => {
    // Arrange
    const constraint = PlanetOwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const target = { type: TargetType.PLANET, ownerPlayerId: null }

    // Act
    const result = evaluatePlanetOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

    // Assert
    expect(result).toBe("Expected target planet to be owned by the submitting player.")
  })
})
