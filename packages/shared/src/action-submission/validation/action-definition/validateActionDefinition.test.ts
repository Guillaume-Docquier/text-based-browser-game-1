import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { validateActionDefinition } from "#shared/action-submission/validation/action-definition/validateActionDefinition.ts"
import { createSubmittedActionStub } from "#shared/domain/actions/Action.stub.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"

describe("validateActionDefinition", () => {
  it("should report an Action Definition that does not exist in the Ruleset", () => {
    // Arrange
    const submittedAction = createSubmittedActionStub({ actionDefinitionId: "UNKNOWN_ACTION" })
    const ruleset = createRulesetStub({ actionDefinitions: {} })

    // Act
    const result = validateActionDefinition([submittedAction], ruleset)

    // Assert
    expect(result).toStrictEqual<typeof result>(
      Result.Success([
        {
          issue: "Action definition does not exist in the Ruleset",
          submittedActionId: submittedAction.id,
          actionDefinitionId: submittedAction.actionDefinitionId,
          actionDefinitionName: undefined,
        },
      ]),
    )
  })
})
