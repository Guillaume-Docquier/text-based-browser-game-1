import { describe, expect, it } from "vitest"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { validateActionSubmissions } from "#lib/rules-engine/action-submission/validation/validateActionSubmissions.ts"
import { createActionDefinitionStub } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.stub.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

const actionDefinition = createActionDefinitionStub({
  costs: [ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY })],
})

const ruleset: Ruleset = {
  name: "Test Ruleset",
  actionDefinitions: {
    [actionDefinition.id]: actionDefinition,
  },
}

describe("validateActionSubmissions", () => {
  it("should not mutate the turnState", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
      },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 5,
          },
        },
      },
    })

    const originalTurnState = structuredClone(turnState)

    // Act
    validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(turnState).toEqual(originalTurnState)
  })

  it("should return no issues for a valid Action Submission", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
      },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 5,
          },
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual([])
  })

  it("should collect target and cost issues from the complete validation pipeline", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission = createActionSubmissionStub({
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
        fleet: "fleet-id",
      },
    })
    const turnState = createTurnStateStub({
      actionSubmissions: [actionSubmission],
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 4,
          },
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Unexpected target slot "fleet"',
        actionSubmissionId: actionSubmission.id,
        actionDefinitionId: actionSubmission.actionDefinitionId,
        actionDefinitionName: actionDefinition.name,
      },
      {
        issue: "Missing 1 MONEY",
        actionSubmissionId: actionSubmission.id,
        actionDefinitionId: actionSubmission.actionDefinitionId,
        actionDefinitionName: actionDefinition.name,
      },
    ])
  })

  describe("action definition", () => {
    it("should report an Action Definition that does not exist in the Ruleset", () => {
      // Arrange
      const actionSubmission = createActionSubmissionStub({
        actionDefinitionId: "UNKNOWN_ACTION",
        targets: {
          self: "player-id",
        },
      })
      const emptyRuleset: Ruleset = {
        name: "Empty Ruleset",
        actionDefinitions: {},
      }
      const turnState = createTurnStateStub()

      // Act
      const issues = validateActionSubmissions([actionSubmission], emptyRuleset, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: "Action definition does not exist in the Ruleset",
          actionSubmissionId: actionSubmission.id,
          actionDefinitionId: actionSubmission.actionDefinitionId,
          actionDefinitionName: undefined,
        },
      ])
    })
  })

  describe("targets", () => {
    it("should report a target slot required by the Action Definition but missing from the submission", () => {
      // Arrange
      const playerId = "player-id"
      const actionDefinitionWithRequiredTarget = createActionDefinitionStub({
        targets: {
          self: "",
          targetPlayer: "",
        },
      })
      const rulesetWithRequiredTarget: Ruleset = {
        name: "Test Ruleset",
        actionDefinitions: {
          [actionDefinitionWithRequiredTarget.id]: actionDefinitionWithRequiredTarget,
        },
      }
      const actionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithRequiredTarget.id,
        targets: {
          self: playerId,
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [actionSubmission],
        players: {
          [playerId]: {
            id: playerId,
            resources: {
              [ResourceType.MONEY]: 5,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([actionSubmission], rulesetWithRequiredTarget, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: 'Missing target slot "targetPlayer"',
          actionSubmissionId: actionSubmission.id,
          actionDefinitionId: actionSubmission.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithRequiredTarget.name,
        },
      ])
    })

    it("should report unexpected target slots", () => {
      // Arrange
      const playerId = "player-id"
      const actionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinition.id,
        targets: {
          self: playerId,
          fleet: "unexpected-fleet-slot",
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [actionSubmission],
        players: {
          [playerId]: {
            id: playerId,
            resources: {
              [ResourceType.MONEY]: 5,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: 'Unexpected target slot "fleet"',
          actionSubmissionId: actionSubmission.id,
          actionDefinitionId: actionSubmission.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ])
    })

    it("should report empty target slots", () => {
      // Arrange
      const actionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinition.id,
        targets: {
          self: "",
        },
      })
      const turnState = createTurnStateStub()

      // Act
      const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: 'Target slot "self" must be set to a SELF id',
          actionSubmissionId: actionSubmission.id,
          actionDefinitionId: actionSubmission.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ])
    })
  })

  describe("costs", () => {
    it("should validate each player's costs against their own resources", () => {
      // Arrange
      const firstPlayerId = "first-player-id"
      const secondPlayerId = "second-player-id"
      const firstPlayerActionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinition.id,
        targets: {
          self: firstPlayerId,
        },
      })
      const secondPlayerActionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinition.id,
        targets: {
          self: secondPlayerId,
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [firstPlayerActionSubmission, secondPlayerActionSubmission],
        players: {
          [firstPlayerId]: {
            id: firstPlayerId,
            resources: {
              [ResourceType.MONEY]: 5,
            },
          },
          [secondPlayerId]: {
            id: secondPlayerId,
            resources: {
              [ResourceType.MONEY]: 4,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([firstPlayerActionSubmission, secondPlayerActionSubmission], ruleset, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: "Missing 1 MONEY",
          actionSubmissionId: secondPlayerActionSubmission.id,
          actionDefinitionId: secondPlayerActionSubmission.actionDefinitionId,
          actionDefinitionName: actionDefinition.name,
        },
      ])
    })

    it("should aggregate costs for the same resource before reporting the shortage", () => {
      // Arrange
      const playerId = "player-id"
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
        ],
      })
      const rulesetWithMultipleCosts: Ruleset = {
        name: "Test Ruleset",
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      }
      const actionSubmission = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithMultipleCosts.id,
        targets: {
          self: playerId,
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [actionSubmission],
        players: {
          [playerId]: {
            id: playerId,
            resources: {
              [ResourceType.MONEY]: 7,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([actionSubmission], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: "Missing 3 MONEY",
          actionSubmissionId: actionSubmission.id,
          actionDefinitionId: actionSubmission.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })

    it("should return issues when the sum of the action costs can't be paid", () => {
      // Arrange
      const playerId = "player-id"
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
        ],
      })
      const rulesetWithMultipleCosts: Ruleset = {
        name: "Test Ruleset",
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      }
      const actionSubmission1 = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithMultipleCosts.id,
        targets: {
          self: playerId,
        },
      })
      const actionSubmission2 = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithMultipleCosts.id,
        targets: {
          self: playerId,
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [actionSubmission1, actionSubmission2],
        players: {
          [playerId]: {
            id: playerId,
            resources: {
              [ResourceType.MONEY]: 14,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([actionSubmission1, actionSubmission2], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: "Missing 6 MONEY",
          actionSubmissionId: actionSubmission2.id,
          actionDefinitionId: actionSubmission2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })

    it("should return issues where the sum of missing resources of each issue is the total missing resources", () => {
      // Arrange
      const playerId = "player-id"
      const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
        costs: [
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
          ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
        ],
      })
      const rulesetWithMultipleCosts: Ruleset = {
        name: "Test Ruleset",
        actionDefinitions: {
          [actionDefinitionWithMultipleCosts.id]: actionDefinitionWithMultipleCosts,
        },
      }
      const actionSubmission1 = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithMultipleCosts.id,
        targets: {
          self: playerId,
        },
      })
      const actionSubmission2 = createActionSubmissionStub({
        actionDefinitionId: actionDefinitionWithMultipleCosts.id,
        targets: {
          self: playerId,
        },
      })
      const turnState = createTurnStateStub({
        actionSubmissions: [actionSubmission1, actionSubmission2],
        players: {
          [playerId]: {
            id: playerId,
            resources: {
              [ResourceType.MONEY]: 7,
            },
          },
        },
      })

      // Act
      const issues = validateActionSubmissions([actionSubmission1, actionSubmission2], rulesetWithMultipleCosts, turnState)

      // Assert
      expect(issues).toEqual<typeof issues>([
        {
          issue: "Missing 3 MONEY",
          actionSubmissionId: actionSubmission1.id,
          actionDefinitionId: actionSubmission1.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
        {
          issue: "Missing 10 MONEY",
          actionSubmissionId: actionSubmission2.id,
          actionDefinitionId: actionSubmission2.actionDefinitionId,
          actionDefinitionName: actionDefinitionWithMultipleCosts.name,
        },
      ])
    })
  })
})
