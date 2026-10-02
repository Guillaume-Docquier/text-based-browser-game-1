import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"

describe("computeAvailableActions", () => {
  it("should use the Action Pool for each player, including distinct copies of one Action Definition", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player")
    const secondPlayerId = branded<PlayerId>("second-player")
    const pooledDefinition = createActionDefinitionStub({ id: "POOLED_ACTION" })
    const unpooledDefinition = createActionDefinitionStub({ id: "UNPOOLED_ACTION" })
    const ruleset = createRulesetStub({
      actionDefinitions: indexBy("id", [pooledDefinition, unpooledDefinition]),
      actionPool: [
        { id: "POOLED_ACTION_1", actionDefinitionId: pooledDefinition.id },
        { id: "POOLED_ACTION_2", actionDefinitionId: pooledDefinition.id },
      ],
    })

    // Act
    const actions = computeAvailableActions({ playerIds: [firstPlayerId, secondPlayerId], ruleset })

    // Assert
    expect(actions).toStrictEqual([
      { id: "POOLED_ACTION_1", playerId: firstPlayerId, actionDefinitionId: pooledDefinition.id, selectedTargets: null },
      { id: "POOLED_ACTION_2", playerId: firstPlayerId, actionDefinitionId: pooledDefinition.id, selectedTargets: null },
      { id: "POOLED_ACTION_1", playerId: secondPlayerId, actionDefinitionId: pooledDefinition.id, selectedTargets: null },
      { id: "POOLED_ACTION_2", playerId: secondPlayerId, actionDefinitionId: pooledDefinition.id, selectedTargets: null },
    ])
  })
})
