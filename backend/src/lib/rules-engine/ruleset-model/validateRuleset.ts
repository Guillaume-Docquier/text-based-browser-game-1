import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"

export type RulesetValidationIssue = { issue: string }

export function validateRuleset(ruleset: Ruleset): RulesetValidationIssue[] {
  const invalidIndexIssues = Object.entries(ruleset.actionDefinitions)
    .filter(([id, actionDefinition]) => id !== actionDefinition.id)
    .map(([actualIndex, actionDefinition]) => ({
      issue: `Action Definition ${actionDefinition.name} is indexed under ${actualIndex} instead of ${actionDefinition.id}`,
    }))

  const missingTargetIssues = Object.values(ruleset.actionDefinitions).flatMap((actionDefinition) =>
    [...actionDefinition.costs, ...actionDefinition.mechanics].flatMap((mechanic) =>
      Object.values(mechanic.targets)
        .filter((target) => !(target.tag in actionDefinition.targets))
        .map((target) => ({
          issue: `Action Definition ${actionDefinition.name} is missing target slot ${target.tag} required by ${mechanic.type}`,
        })),
    ),
  )

  return [...invalidIndexIssues, ...missingTargetIssues]
}
