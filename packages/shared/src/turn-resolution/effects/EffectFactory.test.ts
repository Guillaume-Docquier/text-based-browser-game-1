import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { ActionDefinitionIdSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { AttackMoveTest } from "#shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { EffectFactory } from "#shared/turn-resolution/effects/EffectFactory.ts"
import { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"

describe("EffectFactory", () => {
  it("should return a typed failure when a submitted Action Definition is missing", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const submission = createSubmittedActionStub({
      id: AttackMoveTest.id + "_1",
      playerId,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: {
        fleet: "00000000-0000-4000-8000-000000000002",
        planet: "00000000-0000-4000-8000-000000000003",
      },
      selectedInputs: { strength: 30 },
    })
    const definitionsWithoutAttackMove = Object.fromEntries(
      Object.entries(TestRuleset.actionDefinitions).filter(([id]) => id !== AttackMoveTest.id),
    )
    const rulesetWithoutDefinition = Ruleset.create({
      ...TestRuleset,
      actionDefinitions: definitionsWithoutAttackMove,
      actionPool: TestRuleset.actionPool.filter(({ actionDefinitionId }) => actionDefinitionId !== AttackMoveTest.id),
    })

    // Act
    const result = EffectFactory.fromSubmittedAction(submission, rulesetWithoutDefinition, MonotonicIdFactory.create())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(EffectError.Failed({ error: 'Action Definition "' + AttackMoveTest.id + '" is missing from the Ruleset' })),
    )
  })

  it("should return a typed failure when an Action Definition ID matches an inherited object property", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const actionDefinitionId = typedParse(ActionDefinitionIdSchema, "constructor")
    const submission = createSubmittedActionStub({
      id: AttackMoveTest.id + "_1",
      playerId,
      actionDefinitionId,
    })

    // Act
    const result = EffectFactory.fromSubmittedAction(submission, TestRuleset, MonotonicIdFactory.create())

    // Assert
    expect(result).toStrictEqual(
      Result.Failure(
        EffectError.Failed({
          error: 'Action Definition "' + actionDefinitionId + '" is missing from the Ruleset',
        }),
      ),
    )
  })

  it("should create the expected Effects for an Action Definition stored under its own key", () => {
    // Arrange
    const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000001")
    const submission = createSubmittedActionStub({
      id: AttackMoveTest.id + "_1",
      playerId,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: {
        fleet: "00000000-0000-4000-8000-000000000002",
        planet: "00000000-0000-4000-8000-000000000003",
      },
      selectedInputs: { strength: 30 },
    })

    // Act
    const result = EffectFactory.fromSubmittedAction(submission, TestRuleset, MonotonicIdFactory.create())

    // Assert
    Assert.isSuccess(result)
    expect(result.value).toHaveLength(3)
  })
})
