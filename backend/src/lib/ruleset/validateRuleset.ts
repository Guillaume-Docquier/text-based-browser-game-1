import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export type RulesetValidationResult = {
  valid: boolean
  invalidIndices: Array<{
    actionDefinitionId: string
    expectedIndex: string
    actualIndex: string
  }>
  missingTargets: Array<{
    actionDefinitionId: string
    missingTargetSlot: string
    forMechanicType: string
  }>
}

export function validateRuleset(ruleset: Ruleset): RulesetValidationResult {
  const invalidIndices = Object.entries(ruleset.actionDefinitions)
    .filter(([id, actionDefinition]) => id !== actionDefinition.id)
    .map(([actualIndex, actionDefinition]) => ({
      actionDefinitionId: actionDefinition.id,
      expectedIndex: actionDefinition.id,
      actualIndex,
    }))

  const missingTargets = Object.values(ruleset.actionDefinitions).flatMap((actionDefinition) =>
    [...actionDefinition.costs, ...actionDefinition.mechanics].flatMap((mechanic) =>
      Object.values(mechanic.targets)
        .filter((target) => !(target.tag in actionDefinition.targets))
        .map((target) => ({
          actionDefinitionId: actionDefinition.id,
          missingTargetSlot: target.tag,
          forMechanicType: mechanic.type,
        })),
    ),
  )

  const valid = invalidIndices.length === 0 && missingTargets.length === 0

  return {
    valid,
    invalidIndices,
    missingTargets,
  }
}
