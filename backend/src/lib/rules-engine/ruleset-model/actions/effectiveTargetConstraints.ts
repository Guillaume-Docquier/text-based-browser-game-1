import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

/**
 * Collects the constraints that apply to one Action target slot.
 *
 * Mechanic constraints are collected from costs first, then mechanics, in
 * declaration order. The Action target's own constraints are appended last.
 * The returned list deliberately preserves duplicates because each constraint
 * contributes an independent AND condition at runtime.
 */
export function getEffectiveTargetConstraints(actionDefinition: ActionDefinition, targetTag: string): TargetConstraint[] {
  const constraints: TargetConstraint[] = []

  for (const mechanic of [...actionDefinition.costs, ...actionDefinition.mechanics]) {
    for (const mechanicTarget of Object.values(mechanic.targets)) {
      if (mechanicTarget.tag === targetTag) {
        constraints.push(...mechanicTarget.constraints)
      }
    }
  }

  const actionTarget = actionDefinition.targets[targetTag]
  if (actionTarget !== undefined) {
    constraints.push(...actionTarget.constraints)
  }

  return constraints
}
