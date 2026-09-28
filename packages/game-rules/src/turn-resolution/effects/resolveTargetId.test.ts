import { AssertionError, branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { resolveTargetId, safeResolveTargetId } from "#game-rules/turn-resolution/effects/resolveTargetId.ts"

describe("resolveTargetId", () => {
  describe("safeResolveTargetId", () => {
    it("should return null when no target is selected for the tag", () => {
      // Arrange
      const selectedTargets = {}

      // Act
      const targetId = safeResolveTargetId(selectedTargets, { actionTargetTag: branded("planet"), targetType: TargetType.PLANET })

      // Assert
      expect(targetId).toBeNull()
    })

    it("should resolve selected targets without validating them", () => {
      // Arrange
      const selectedTargets = { planet: "planet-id" }

      // Act
      const safeTargetId = safeResolveTargetId(selectedTargets, { actionTargetTag: branded("planet"), targetType: TargetType.PLANET })
      const targetId = resolveTargetId(selectedTargets, { actionTargetTag: branded("planet"), targetType: TargetType.PLANET })

      // Assert
      expect(safeTargetId).toBe("planet-id")
      expect(targetId).toBe("planet-id")
    })

    it("should resolve Fleet targets", () => {
      // Arrange
      const selectedTargets = { fleet: "fleet-id" }

      // Act
      const targetId = safeResolveTargetId(selectedTargets, { actionTargetTag: branded("fleet"), targetType: TargetType.FLEET })

      // Assert
      expect(targetId).toBe("fleet-id")
    })
  })

  describe("resolveTargetId", () => {
    it("should throw when no target is selected for the tag", () => {
      // Arrange
      const selectedTargets = {}

      // Act & Assert
      expect(() => resolveTargetId(selectedTargets, { actionTargetTag: branded("planet"), targetType: TargetType.PLANET })).toThrow(
        AssertionError,
      )
    })
  })
})
