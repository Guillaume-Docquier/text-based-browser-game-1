import { z } from "zod"
import { type Ruleset, RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { safeTypedParse } from "#lib/validation/typedParse.ts"

export type RulesetValidationIssue = { issue: string }

export function validateRuleset(ruleset: Ruleset): RulesetValidationIssue[] {
  const rulesetValidation = safeTypedParse(RulesetSchema, ruleset)
  if (rulesetValidation.success) {
    return []
  }

  return rulesetValidation.error.issues.map((issue) => ({
    issue: issue.code === "custom" ? issue.message : z.prettifyError(new z.ZodError([issue])),
  }))
}
