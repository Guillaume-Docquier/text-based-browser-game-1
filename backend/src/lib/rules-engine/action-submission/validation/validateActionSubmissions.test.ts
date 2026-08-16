import { describe, expect, it } from "vitest"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
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
  it("should return no issues for a valid Action Submission", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
      },
    }
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 5,
          },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual([])
  })

  it("should report an Action Definition that does not exist in the Ruleset", () => {
    // Arrange
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: "UNKNOWN_ACTION",
      targets: {
        self: "player-id",
      },
    }
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
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "UNKNOWN_ACTION",
        actionDefinitionName: undefined,
      },
    ])
  })

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
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinitionWithRequiredTarget.id,
      targets: {
        self: playerId,
      },
    }
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 5,
          },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], rulesetWithRequiredTarget, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Missing target slot "targetPlayer"',
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
      },
    ])
  })

  it("should report unexpected target slots", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
        fleet: "unexpected-fleet-slot",
      },
    }
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 5,
          },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Unexpected target slot "fleet"',
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
      },
    ])
  })

  it("should report empty target slots", () => {
    // Arrange
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: "",
      },
    }
    const turnState = createTurnStateStub()

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Target slot "self" must be set to a SELF id',
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
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
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinitionWithMultipleCosts.id,
      targets: {
        self: playerId,
      },
    }
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 7,
          },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], rulesetWithMultipleCosts, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: "Missing 3 MONEY",
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
      },
    ])
  })

  it("should collect target and cost issues from the complete validation pipeline", () => {
    // Arrange
    const playerId = "player-id"
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: playerId,
        fleet: "fleet-id",
      },
    }
    const turnState = createTurnStateStub({
      players: {
        [playerId]: {
          id: playerId,
          resources: {
            [ResourceType.MONEY]: 4,
          },
          actionSubmissions: [actionSubmission],
        },
      },
    })

    // Act
    const issues = validateActionSubmissions([actionSubmission], ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Unexpected target slot "fleet"',
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
      },
      {
        issue: "Missing 1 MONEY",
        actionSubmissionId: "action-submission-id",
        actionDefinitionId: "TEST_ACTION",
        actionDefinitionName: "Test Action",
      },
    ])
  })
})
