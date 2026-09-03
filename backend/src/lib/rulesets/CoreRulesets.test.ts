import { describe, expect, it } from "vitest"
import { validateRuleset } from "#lib/rules-engine/ruleset-model/validateRuleset.ts"
import { CoreRulesets } from "#lib/rulesets/CoreRulesets.ts"

const rulesetsById = Map.groupBy(CoreRulesets, (ruleset) => ruleset.id)
const rulesetsByName = Map.groupBy(CoreRulesets, (ruleset) => ruleset.name)

describe("CoreRulesets", () => {
  it("should only have a single default ruleset", () => {
    // Act
    const defaultRulesets = CoreRulesets.filter((ruleset) => ruleset.isDefault)

    // Assert
    expect(defaultRulesets.map((ruleset) => ruleset.name)).toStrictEqual([expect.any(String)]) // We don't care which one is the default as long as there's only 1
  })

  describe.each(CoreRulesets)("$name", (ruleset) => {
    it(`should be valid`, () => {
      // Act
      const validationIssues = validateRuleset(ruleset)

      // Assert
      expect(validationIssues).toStrictEqual([])
    })

    it(`should have a unique id`, () => {
      // Act
      const rulesetsWithId = rulesetsById.getOrInsert(ruleset.id, [])

      // Assert
      expect(rulesetsWithId.map((ruleset) => ruleset.name)).toStrictEqual([ruleset.name])
    })

    it(`should have a unique name`, () => {
      // Act
      const rulesetsWithName = rulesetsByName.getOrInsert(ruleset.name, [])

      // Assert
      expect(rulesetsWithName.map((ruleset) => ruleset.id)).toStrictEqual([ruleset.id])
    })
  })
})
