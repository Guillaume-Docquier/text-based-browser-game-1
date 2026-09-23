import { AssertionError } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { resolveTargetId, safeResolveTargetId } from "#lib/rules-engine/turn-resolution/effects/resolveTargetId.ts"

describe("resolveTargetId", () => {
  describe("safeResolveTargetId", () => {
    it("should return null when the target slot is not selected", () => {
      // Arrange
      const selectedTargets = {}

      // Act
      const targetId = safeResolveTargetId(selectedTargets, { tag: "planet", targetType: TargetType.PLANET })

      // Assert
      expect(targetId).toBeNull()
    })

    it("should resolve selected targets without validating them", () => {
      // Arrange
      const selectedTargets = { planet: "-1" }

      // Act
      const safeTargetId = safeResolveTargetId(selectedTargets, { tag: "planet", targetType: TargetType.PLANET })
      const targetId = resolveTargetId(selectedTargets, { tag: "planet", targetType: TargetType.PLANET })

      // Assert
      expect(safeTargetId).toBe(-1)
      expect(targetId).toBe(-1)
    })

    it("should resolve Fleet targets", () => {
      // Arrange
      const selectedTargets = { fleet: "fleet-id" }

      // Act
      const targetId = safeResolveTargetId(selectedTargets, { tag: "fleet", targetType: TargetType.FLEET })

      // Assert
      expect(targetId).toBe("fleet-id")
    })
  })

  describe("resolveTargetId", () => {
    it("should throw when the target slot is not selected", () => {
      // Arrange
      const selectedTargets = {}

      // Act & Assert
      expect(() => resolveTargetId(selectedTargets, { tag: "planet", targetType: TargetType.PLANET })).toThrow(AssertionError)
    })
  })
})
