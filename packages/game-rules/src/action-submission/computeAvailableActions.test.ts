import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { computeAvailableActions } from "#game-rules/action-submission/computeAvailableActions.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import { createActionDefinitionStub } from "#game-rules/ruleset/action-definitions/ActionDefinition.stub.ts"
import { createCompiledRulesetStub } from "#game-rules/ruleset/CompiledRuleset.stub.ts"

describe("computeAvailableActions", () => {
  it("should use the Action Pool for each player, including distinct copies of one Action Definition", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player")
    const secondPlayerId = branded<PlayerId>("second-player")
    const pooledDefinition = createActionDefinitionStub({ id: "POOLED_ACTION" })
    const unpooledDefinition = createActionDefinitionStub({ id: "UNPOOLED_ACTION" })
    const ruleset = createCompiledRulesetStub({
      actionDefinitions: indexBy("id", [pooledDefinition, unpooledDefinition]),
      actionPool: [{ actionDefinitionId: pooledDefinition.id }, { actionDefinitionId: pooledDefinition.id }],
    })

    // Act
    const actions = computeAvailableActions({ playerIds: [firstPlayerId, secondPlayerId], ruleset })

    // Assert
    expect(actions).toStrictEqual([
      {
        id: "8ee6a227-3423-54ee-bb4b-746b6b94e14d",
        playerId: firstPlayerId,
        actionDefinitionId: pooledDefinition.id,
        selectedTargets: null,
      },
      {
        id: "e78a1435-91dc-5cee-bdf8-1579ad1c6621",
        playerId: firstPlayerId,
        actionDefinitionId: pooledDefinition.id,
        selectedTargets: null,
      },
      {
        id: "8ee6a227-3423-54ee-bb4b-746b6b94e14d",
        playerId: secondPlayerId,
        actionDefinitionId: pooledDefinition.id,
        selectedTargets: null,
      },
      {
        id: "e78a1435-91dc-5cee-bdf8-1579ad1c6621",
        playerId: secondPlayerId,
        actionDefinitionId: pooledDefinition.id,
        selectedTargets: null,
      },
    ])
  })
})
