import { describe, expect, it } from "vitest"
import { Ruleset } from "#lib/ruleset/Ruleset.ts"
import { validateRuleset } from "#lib/ruleset/validateRuleset.ts"

describe("Ruleset", () => {
  it("should be valid", () => {
    // Arrange
    const ruleset = Ruleset

    // Act
    const validationIssues = validateRuleset(ruleset)

    // Assert
    expect(validationIssues).toEqual([])
  })
})
