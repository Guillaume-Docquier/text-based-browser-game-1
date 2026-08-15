import { describe, expect, it } from "vitest"
import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import { validateActionSubmission } from "#lib/rules-engine/actions/validation/validateActionSubmission.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

const actionDefinition: ActionDefinition = {
  id: "TEST_ACTION",
  name: "Test Action",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: {
    self: "",
  },
  costs: [CostMechanic.create({ quantity: 5, resourceType: ResourceType.MONEY })],
  mechanics: [],
}

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
            [ResourceType.MONEY]: 10,
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
        issue: "Action Definition UNKNOWN_ACTION referenced by action action-submission-id does not exist in the Ruleset",
      },
    ])
  })

  it("should report all missing, empty, and unexpected target slots", () => {
    // Arrange
    const actionSubmission: ActionSubmission = {
      id: "action-submission-id",
      actionDefinitionId: actionDefinition.id,
      targets: {
        self: "",
        fleet: "fleet-id",
      },
    }
    const turnState = createTurnStateStub()

    // Act
    const issues = validateActionSubmission(actionSubmission, ruleset, turnState)

    // Assert
    expect(issues).toEqual<typeof issues>([
      {
        issue: "Submitted action action-submission-id self target  is not a player.",
      },
      {
        issue: "Submitted action action-submission-id fleet target slot is unexpected.",
      },
      {
        issue: "Submitted action action-submission-id self target  is not a player.",
      },
    ])
  })
})
