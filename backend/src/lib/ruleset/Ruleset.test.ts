import { describe, expect, it } from "vitest"
import { Ruleset } from "#lib/ruleset/Ruleset.ts"
import { validateRuleset } from "#lib/ruleset/validateRuleset.ts"

describe("Ruleset", () => {
  it("should be valid", () => {
    // Act
    const validationResult = validateRuleset(Ruleset)

    // Assert
    expect(validationResult).toEqual<typeof validationResult>({
      valid: true,
      invalidIndices: [],
      missingTargets: [],
    })
  })
})
