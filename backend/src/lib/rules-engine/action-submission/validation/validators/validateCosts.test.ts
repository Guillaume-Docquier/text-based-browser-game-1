import { branded, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateCosts } from "#lib/rules-engine/action-submission/validation/validators/validateCosts.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset/actions/ActionDefinition.stub.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset/Ruleset.stub.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

const actionDefinition = createActionDefinitionStub({
  costs: [ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE })],
})

const ruleset = createRulesetStub({
  actionDefinitions: {
    [actionDefinition.id]: actionDefinition,
  },
  startingResources: createResourcesStub({
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
    [ResourceType.FUEL]: 1,
  }),
})

describe("validateCosts", () => {
  it("should not mutate the turnState", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }),
        },
      },
    })
    const originalTurnState = structuredClone(turnState)

    // Act
    validateCosts([submittedAction], ruleset, turnState)

    // Assert
    expect(turnState).toStrictEqual(originalTurnState)
  })

  it("should validate each player's costs against their own resources", () => {
    // Arrange
    const firstPlayerId = branded<PlayerId>("first-player-id")
    const secondPlayerId = branded<PlayerId>("second-player-id")
    const firstPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId: firstPlayerId })
    const secondPlayerSubmittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinition.id, playerId: secondPlayerId })
    const turnState = createTurnStateStub({
      submittedActions: [firstPlayerSubmittedAction, secondPlayerSubmittedAction],
      players: {
        [firstPlayerId]: {
          id: firstPlayerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 5 }),
        },
        [secondPlayerId]: {
          id: secondPlayerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 4 }),
        },
      },
    })

    // Act
    const result = validateCosts([firstPlayerSubmittedAction, secondPlayerSubmittedAction], ruleset, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Missing 1 INFLUENCE",
          submittedActionId: secondPlayerSubmittedAction.id,
          actionDefinitionId: secondPlayerSubmittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ]),
    )
  })

  it("should aggregate costs for the same resource before reporting the shortage", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
      ],
    })
    const rulesetWithMultipleCosts = createRulesetStub({
      actionDefinitions: {
        [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
      },
    })
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 7 }),
        },
      },
    })

    // Act
    const result = validateCosts([submittedAction], rulesetWithMultipleCosts, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Missing 3 INFLUENCE",
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ]),
    )
  })

  it("should return issues when the sum of the action costs can't be paid", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
      ],
    })
    const rulesetWithMultipleCosts = createRulesetStub({
      actionDefinitions: {
        [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
      },
    })
    const submittedAction1 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
    const submittedAction2 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction1, submittedAction2],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 14 }),
        },
      },
    })

    // Act
    const result = validateCosts([submittedAction1, submittedAction2], rulesetWithMultipleCosts, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Missing 6 INFLUENCE",
          submittedActionId: submittedAction2.id,
          actionDefinitionId: submittedAction2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ]),
    )
  })

  it("should return issues where the sum of missing resources of each issue is the total missing resources", () => {
    // Arrange
    const playerId = branded<PlayerId>("player-id")
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
      ],
    })
    const rulesetWithMultipleCosts = createRulesetStub({
      actionDefinitions: {
        [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
      },
    })
    const submittedAction1 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
    const submittedAction2 = createSubmittedActionStub({ actionDefinitionId: actionDefinitionWithMultipleCosts.id, playerId })
    const turnState = createTurnStateStub({
      submittedActions: [submittedAction1, submittedAction2],
      players: {
        [playerId]: {
          id: playerId,
          resources: createResourcesStub({ [ResourceType.INFLUENCE]: 7 }),
        },
      },
    })

    // Act
    const result = validateCosts([submittedAction1, submittedAction2], rulesetWithMultipleCosts, turnState)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Missing 3 INFLUENCE",
          submittedActionId: submittedAction1.id,
          actionDefinitionId: submittedAction1.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
        {
          issue: "Missing 10 INFLUENCE",
          submittedActionId: submittedAction2.id,
          actionDefinitionId: submittedAction2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ]),
    )
  })
})
