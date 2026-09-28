import { branded, Result } from "@guillaume-docquier/tools-ts"
import { evaluateOwnedBySubmittingPlayerConstraint } from "game-rules/action-submission/validation/validators/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.ts"
import { FleetNameSchema } from "game-rules/models/FleetName.ts"
import type { PlayerId } from "game-rules/models/PlayerId.ts"
import { createResourcesStub } from "game-rules/ruleset/effect-definitions/Resources.stub.ts"
import { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetableFleet, TargetablePlanet, TargetablePlayer } from "game-rules/turn-resolution/TargetableEntity.ts"
import { typedParse } from "game-rules/validation/typedParse.ts"
import { describe, expect, it } from "vitest"

describe("evaluateOwnedBySubmittingPlayerConstraint", () => {
  describe("evaluate", () => {
    const constraint = OwnedBySubmittingPlayerConstraint.create()
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const otherPlayerId = branded<PlayerId>("other-player")

    it("should accept a fleet owned by the submitting player", () => {
      // Arrange
      const target: TargetableFleet = {
        type: TargetType.FLEET,
        id: branded("fleet-id"),
        ownerPlayerId: submittingPlayerId,
        name: typedParse(FleetNameSchema, "Test Fleet"),
        strength: 1,
        originPlanetId: branded("1"),
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success(undefined))
    })

    it("should report a fleet owned by another player", () => {
      // Arrange
      const target: TargetableFleet = {
        type: TargetType.FLEET,
        id: branded("fleet-id"),
        ownerPlayerId: otherPlayerId,
        name: typedParse(FleetNameSchema, "Test Fleet"),
        strength: 1,
        originPlanetId: branded("1"),
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target fleet to be owned by the submitting player."))
    })

    it("should accept a planet owned by the submitting player", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded("1"),
        ownerPlayerId: submittingPlayerId,
        x: 0,
        y: 0,
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success(undefined))
    })

    it("should report a planet owned by another player", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded("1"),
        ownerPlayerId: otherPlayerId,
        x: 0,
        y: 0,
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target planet to be owned by the submitting player."))
    })

    it("should report an unowned planet", () => {
      // Arrange
      const target: TargetablePlanet = {
        type: TargetType.PLANET,
        id: branded("1"),
        ownerPlayerId: null,
        x: 0,
        y: 0,
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

      // Assert
      expect(result).toStrictEqual<typeof result>(Result.Success("Expected target planet to be owned by the submitting player."))
    })

    it("should reject a player target as incompatible", () => {
      // Arrange
      const target: TargetablePlayer = {
        type: TargetType.PLAYER,
        id: otherPlayerId,
        resources: createResourcesStub(),
      }

      // Act
      const result = evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })

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
