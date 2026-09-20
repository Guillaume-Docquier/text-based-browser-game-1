import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"
import {
  createFleetTargetStub,
  createPlanetTargetStub,
  createPlayerTargetStub,
  createTargetConstraintEvaluationContextStub,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.stub.ts"
import { TargetConstraintSchema } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import {
  getTargetConstraintImplementation,
  TargetConstraintImplementations,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintRegistry.ts"
import {
  ActionTargetReferenceSchema,
  MechanicTargetReferenceSchema,
  TargetReferenceSchema,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetReference.ts"

describe("target constraints", () => {
  it("should create a value that parses with the central schema", () => {
    // Arrange
    const constraint = OwnedBySubmittingPlayerConstraint.create()

    // Act
    const parsedConstraint = TargetConstraintSchema.parse(constraint)

    // Assert
    expect(parsedConstraint).toStrictEqual(constraint)
  })

  it("should accept an owned planet", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createPlanetTargetStub(submittingPlayerId),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(Result.Success([]))
  })

  it("should accept an owned fleet", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createFleetTargetStub(submittingPlayerId),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(Result.Success([]))
  })

  it("should report an unclaimed planet as an ownership issue", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createPlanetTargetStub(null),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Success([
        {
          issue: 'Target "target" is not owned by submitting player "player-1".',
        },
      ]),
    )
  })

  it("should report an opponent planet as an ownership issue", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createPlanetTargetStub(branded<PlayerId>("player-2")),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Success([
        {
          issue: 'Target "target" is not owned by submitting player "player-1".',
        },
      ]),
    )
  })

  it("should report an opponent fleet as an ownership issue", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createFleetTargetStub(branded<PlayerId>("player-2")),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Success([
        {
          issue: 'Target "target" is not owned by submitting player "player-1".',
        },
      ]),
    )
  })

  it("should fail for a player target", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createPlayerTargetStub(submittingPlayerId),
      submittingPlayerId,
    })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure({
        type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
        constraintType: "OWNED_BY_SUBMITTING_PLAYER",
        targetType: "PLAYER",
        message: 'Target constraint "OWNED_BY_SUBMITTING_PLAYER" does not support target type "PLAYER".',
      }),
    )
  })

  it("should fail for a mismatched target discriminator", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createFleetTargetStub(submittingPlayerId),
      submittingPlayerId,
    })
    Object.assign(context, { target: { type: "FLEET", planet: {} } })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure({
        type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
        constraintType: "OWNED_BY_SUBMITTING_PLAYER",
        targetType: "FLEET",
        message: "The target constraint evaluation context is malformed.",
      }),
    )
  })

  it("should fail for a malformed context", () => {
    // Arrange
    const submittingPlayerId = branded<PlayerId>("player-1")
    const context = createTargetConstraintEvaluationContextStub({
      target: createFleetTargetStub(submittingPlayerId),
      submittingPlayerId,
    })
    Object.assign(context, { turnState: undefined })

    // Act
    const result = OwnedBySubmittingPlayerConstraint.evaluate(context)

    // Assert
    expect(result).toStrictEqual(
      Result.Failure({
        type: "TARGET_CONSTRAINT_EVALUATION_ERROR",
        constraintType: "OWNED_BY_SUBMITTING_PLAYER",
        targetType: "FLEET",
        message: "The target constraint evaluation context is malformed.",
      }),
    )
  })

  it("should discriminate Action and Mechanic target references", () => {
    // Arrange
    const actionReference = { type: "ACTION_TARGET", tag: "planet" }
    const mechanicReference = { type: "MECHANIC_TARGET", role: "planet" }

    // Act
    const parsedActionReference = ActionTargetReferenceSchema.parse(actionReference)
    const parsedMechanicReference = MechanicTargetReferenceSchema.parse(mechanicReference)
    const parsedUnionReference = TargetReferenceSchema.parse(mechanicReference)

    // Assert
    expect(parsedActionReference).toStrictEqual(actionReference)
    expect(parsedMechanicReference).toStrictEqual(mechanicReference)
    expect(parsedUnionReference).toStrictEqual(mechanicReference)
    expect(ActionTargetReferenceSchema.safeParse(mechanicReference).success).toBe(false)
    expect(MechanicTargetReferenceSchema.safeParse(actionReference).success).toBe(false)
  })

  it("should look up the owned-by-submitting-player implementation in the registry", () => {
    // Arrange
    const constraint = OwnedBySubmittingPlayerConstraint.create()

    // Act
    const implementation = getTargetConstraintImplementation(constraint)

    // Assert
    expect(TargetConstraintImplementations[constraint.type]).toStrictEqual(OwnedBySubmittingPlayerConstraint)
    expect(implementation).toStrictEqual(OwnedBySubmittingPlayerConstraint)
  })
})
