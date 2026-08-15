import { describe, expect, it } from "vitest"
import { createActionDefinitionStub } from "#lib/rules-engine/actions/ActionDefinition.stub.ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { validateActionSubmission } from "#lib/rules-engine/actions/validation/validateActionSubmission.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const actionDefinition = createActionDefinitionStub({
  costs: [CostMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY })],
})

const ruleset: Ruleset = {
  actionDefinitions: {
    [actionDefinition.id]: actionDefinition,
  },
}

describe("validateActionSubmission", () => {
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
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

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
      actionDefinitions: {},
    }
    const turnState = createTurnStateStub()

    // Act
    const issues = validateActionSubmission(actionSubmission, emptyRuleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: "Action Submission action-submission-id for Action Definition UNKNOWN_ACTION: does not exist in the Ruleset.",
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
    const issues = validateActionSubmission(actionSubmission, rulesetWithRequiredTarget, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue:
          'Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): missing target slot "targetPlayer".',
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
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): unexpected target slot "fleet".',
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
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue:
          'Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): target slot "self" must be set to a SELF id.',
      },
    ])
  })

  it("should aggregate costs for the same resource before reporting the shortage", () => {
    // Arrange
    const playerId = "player-id"
    const actionDefinitionWithMultipleCosts = createActionDefinitionStub({
      costs: [
        CostMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
        CostMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY }),
      ],
    })
    const rulesetWithMultipleCosts: Ruleset = {
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
    const issues = validateActionSubmission(actionSubmission, rulesetWithMultipleCosts, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: "Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): missing 3 MONEY.",
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
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: 'Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): unexpected target slot "fleet".',
      },
      {
        issue: "Action Submission action-submission-id for Action Definition TEST_ACTION (Test Action): missing 1 MONEY.",
      },
    ])
  })
})
