import { z } from "zod"
import { type Ruleset, RulesetSchema } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { safeBrand } from "#lib/validation/brand.ts"

export type RulesetValidationIssue = { issue: string }

export function validateRuleset(ruleset: Ruleset): RulesetValidationIssue[] {
  const issues: RulesetValidationIssue[] = []

  const rulesetValidation = safeBrand(RulesetSchema, ruleset)
  if (!rulesetValidation.success) {
    issues.push({ issue: z.prettifyError(rulesetValidation.error) })
  }

  // TODO1 GD Rely entirely on zod
  const invalidIndexIssues = Object.entries(ruleset.actionDefinitions)
    .filter(([id, actionDefinition]) => id !== actionDefinition.id)
    .map(([actualIndex, actionDefinition]) => ({
      issue: `Action Definition ${actionDefinition.name} is indexed under ${actualIndex} instead of ${actionDefinition.id}`,
    }))
  issues.push(...invalidIndexIssues)

  const missingTargetIssues = Object.values(ruleset.actionDefinitions).flatMap((actionDefinition) =>
    [...actionDefinition.costs, ...actionDefinition.mechanics].flatMap((mechanic) =>
      Object.values(mechanic.targets)
        .filter((target) => !(target.tag in actionDefinition.targets))
        .map((target) => ({
          issue: `Action Definition ${actionDefinition.name} is missing target slot ${target.tag} required by ${mechanic.type}`,
        })),
    ),
  )
  issues.push(...missingTargetIssues)

  return issues
}
