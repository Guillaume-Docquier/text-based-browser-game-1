import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { evaluateFleetOwnedBySubmittingPlayerConstraint } from "#shared/action-submission/validation/targets/target-constraints/fleet/evaluateFleetOwnedBySubmittingPlayerConstraint.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

describe("evaluateFleetOwnedBySubmittingPlayerConstraint", () => {
  it("should accept a fleet owned by the submitting player", () => {
    // Arrange
    const constraint = FleetOwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const target = { type: TargetType.FLEET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = evaluateFleetOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

    // Assert
    expect(result).toBeUndefined()
  })

  it("should report a fleet owned by another player", () => {
    // Arrange
    const constraint = FleetOwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const target = { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("other-player") }

    // Act
    const result = evaluateFleetOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

    // Assert
    expect(result).toBe("Expected target fleet to be owned by the submitting player.")
  })
})
