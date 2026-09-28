import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#game-rules/action-submission/Action.stub.ts"
import { validateSubmittedActions } from "#game-rules/action-submission/validation/validateSubmittedActions.ts"
import { createRulesetStub } from "#game-rules/ruleset/Ruleset.stub.ts"
import { createTurnStateStub } from "#game-rules/turn-resolution/TurnState.stub.ts"

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
