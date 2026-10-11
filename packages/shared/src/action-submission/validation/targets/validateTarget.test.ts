import { branded } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { validateTarget } from "#shared/action-submission/validation/targets/validateTarget.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { FleetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"
import { PlanetOwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"
import { createTargetDefinitionStub } from "#shared/domain/ruleset/target-definitions/TargetDefinition.stub.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

describe("validateTarget", () => {
  it("should accept a planet owned by the submitting player", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.PLANET,
      constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.PLANET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBeNull()
  })

  it("should report only the first planet constraint issue", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.PLANET,
      constraints: [PlanetOwnedBySubmittingPlayerConstraint.create(), PlanetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.PLANET, ownerPlayerId: null }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected target planet to be owned by the submitting player.")
  })

  it("should accept a fleet owned by the submitting player", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.FLEET,
      constraints: [FleetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.FLEET, ownerPlayerId: submittingPlayerId }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBeNull()
  })

  it("should report only the first fleet constraint issue", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.FLEET,
      constraints: [FleetOwnedBySubmittingPlayerConstraint.create(), FleetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("other-player") }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected target fleet to be owned by the submitting player.")
  })

  it.each([
    { targetType: TargetType.FLEET, target: { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("submitting-player") } },
    { targetType: TargetType.PLANET, target: { type: TargetType.PLANET, ownerPlayerId: null } },
    { targetType: TargetType.PLAYER, target: { type: TargetType.PLAYER } },
  ])("should accept a matching $targetType target with no constraints", ({ targetType, target }) => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({ targetType })

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBeNull()
  })

  it.each([
    { slotType: TargetType.PLANET, target: { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("submitting-player") } },
    { slotType: TargetType.PLAYER, target: { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("submitting-player") } },
    { slotType: TargetType.FLEET, target: { type: TargetType.PLANET, ownerPlayerId: null } },
    { slotType: TargetType.PLAYER, target: { type: TargetType.PLANET, ownerPlayerId: null } },
    { slotType: TargetType.FLEET, target: { type: TargetType.PLAYER } },
    { slotType: TargetType.PLANET, target: { type: TargetType.PLAYER } },
  ])("should reject a $target.type entity in a $slotType slot", ({ target, slotType }) => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({ targetType: slotType })

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe(`Expected a ${slotType} target, received ${target.type}`)
  })

  it("should report a fleet slot type mismatch before checking ownership", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.FLEET,
      constraints: [FleetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.PLANET, ownerPlayerId: null }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected a FLEET target, received PLANET")
  })

  it("should report a planet slot type mismatch before checking ownership", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("submitting-player")
    const targetDefinition = createTargetDefinitionStub({
      targetType: TargetType.PLANET,
      constraints: [PlanetOwnedBySubmittingPlayerConstraint.create()],
    })
    const target = { type: TargetType.FLEET, ownerPlayerId: branded<PlayerId>("other-player") }

    // Act
    const result = validateTarget({ target, submittingPlayerId, targetDefinition })

    // Assert
    expect(result).toBe("Expected a PLANET target, received FLEET")
  })
})
