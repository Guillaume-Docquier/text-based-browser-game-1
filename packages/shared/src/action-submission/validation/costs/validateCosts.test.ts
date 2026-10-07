import { Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { validateCosts } from "#shared/action-submission/validation/costs/validateCosts.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { createActionDefinitionStub } from "#shared/domain/ruleset/action-definitions/ActionDefinition.stub.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

const actionDefinition = createActionDefinitionStub({
  costs: [ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE })],
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
    const playerId = typedParse(PlayerIdSchema, v4())
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
    const firstPlayerId = typedParse(PlayerIdSchema, v4())
    const secondPlayerId = typedParse(PlayerIdSchema, v4())
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
    const playerId = typedParse(PlayerIdSchema, v4())
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
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
    const playerId = typedParse(PlayerIdSchema, v4())
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
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
    const playerId = typedParse(PlayerIdSchema, v4())
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
        ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
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
