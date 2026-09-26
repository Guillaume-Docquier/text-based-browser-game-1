import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#lib/rules-engine/action-submission/Action.stub.ts"
import { validateActionDefinition } from "#lib/rules-engine/action-submission/validation/validators/validateActionDefinition.ts"
import { createRulesetStub } from "#lib/rules-engine/ruleset/Ruleset.stub.ts"

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
