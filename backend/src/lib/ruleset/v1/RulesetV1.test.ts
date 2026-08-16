import { describe, expect, it } from "vitest"
import { validateRuleset } from "#lib/rules-engine/ruleset/validateRuleset.ts"
import { RulesetV1 } from "#lib/ruleset/v1/RulesetV1.ts"

describe("RulesetV1", () => {
  it("should be valid", () => {
    // Arrange
    const ruleset = RulesetV1

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual([])
  })
})
