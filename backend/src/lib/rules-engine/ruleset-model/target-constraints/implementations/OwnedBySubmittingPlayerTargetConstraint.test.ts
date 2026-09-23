import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetableFleet, TargetablePlanet, TargetablePlayer } from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"

describe("OwnedBySubmittingPlayerConstraint.evaluate", () => {
  describe("evaluate", () => {
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const otherPlayerId = branded<PlayerId>("other-player")

    it("should accept a fleet owned by the submitting player", () => {
      // Arrange
      const target: TargetableFleet = {
        type: TargetType.FLEET,
        id: branded("fleet-id"),
        playerId: submittingPlayerId,
        strength: 1,
        originPlanetId: branded(1),
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success(undefined))
    })

    it("should reports a fleet owned by another player", () => {
      // Arrange
      const target: TargetableFleet = {
        type: TargetType.FLEET,
        id: branded("fleet-id"),
        playerId: otherPlayerId,
        strength: 1,
        originPlanetId: branded(1),
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target fleet to be owned by the submitting player."))
    })

    it("should accepts a planet owned by the submitting player", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded(1),
        ownerPlayerId: submittingPlayerId,
        x: 0,
        y: 0,
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success(undefined))
    })

    it("should reports a planet owned by another player", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded(1),
        ownerPlayerId: otherPlayerId,
        x: 0,
        y: 0,
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target planet to be owned by the submitting player."))
    })

    it("should reports an unowned planet", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded(1),
        ownerPlayerId: null,
        x: 0,
        y: 0,
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target planet to be owned by the submitting player."))
    })

    it("should rejects a player target as incompatible", () => {
      // Arrange
      const target: TargetablePlayer = {
        type: TargetType.PLAYER,
        id: otherPlayerId,
        resources: createResourcesStub(),
      }

      // Act
      const result = OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(
        Result.Failure({
          type: "INCOMPATIBLE_TARGET_TYPE",
          targetConstraintType: OwnedBySubmittingPlayerConstraint.type,
          targetType: TargetType.PLAYER,
          error: "A player cannot be owned, this constraint is invalid.",
        }),
      )
    })
  })
})
