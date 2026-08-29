import { describe, expect, it } from "vitest"
import { validateRuleset } from "#lib/rules-engine/ruleset-model/validateRuleset.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

describe("StandardRuleset", () => {
  it("should be valid", () => {
    // Arrange
    const ruleset = StandardRuleset

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toStrictEqual([])
  })
})
