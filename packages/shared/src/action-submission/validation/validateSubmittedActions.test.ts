import { describe, expect, it } from "vitest"
import { validateSubmittedActions } from "#shared/action-submission/validation/validateSubmittedActions.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { createTurnStateStub } from "#shared/turn-resolution/TurnState.stub.ts"

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
