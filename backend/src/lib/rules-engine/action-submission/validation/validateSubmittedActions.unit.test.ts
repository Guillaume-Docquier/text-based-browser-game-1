import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset/Ruleset.stub.ts"
import { createTurnStateStub } from "#lib/rules-engine/turn-resolution/TurnState.stub.ts"

describe("validateSubmittedActions", () => {
  it("should discard validator failures", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
    const ruleset = createRulesetStub({ actionDefinitions: {} })
    const turnState = createTurnStateStub()

    // Act
    const issues = validateSubmittedActions([submittedAction], ruleset, turnState)

    // Assert
    expect(issues).toStrictEqual<typeof issues>([
      {
        issue: "Action definition does not exist in the Ruleset",
        submittedActionId: submittedAction.id,
        actionDefinitionId: submittedAction.actionDefinitionId,
        actionDefinitionName: undefined,
      },
    ])
  })
})
