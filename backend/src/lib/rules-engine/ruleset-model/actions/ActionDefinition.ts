import { z } from "zod"
import {
  ActionTargetDefinitionSchema,
  type ActionTargetDefinition,
} from "#lib/rules-engine/ruleset-model/actions/ActionTargetDefinition.ts"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { MechanicSchema, type Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import { getTargetConstraintImplementation } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintRegistry.ts"
export type { ActionTargetDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionTargetDefinition.ts"
export { getEffectiveTargetConstraints } from "#lib/rules-engine/ruleset-model/actions/effectiveTargetConstraints.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinitionId = string
export const ActionDefinitionIdSchema = z.string() satisfies z.ZodType<ActionDefinitionId>

export type ActionDefinition = Readonly<{
  /**
   * Unique action definition id for reference in action submissions.
   */
  id: ActionDefinitionId
  /**
   * Displayed in the UI.
   */
  name: string
  type: ActionType
  tier: ActionTier
  /**
   * Maps target tags to the target definition accepted by each target slot.
   */
  targets: Readonly<Record<string, ActionTargetDefinition>>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>

export const ActionDefinitionTargetsSchema = z.record(z.string(), ActionTargetDefinitionSchema).readonly() satisfies z.ZodType<
  ActionDefinition["targets"]
>

export const ActionDefinitionSchema = z
  .object({
    id: ActionDefinitionIdSchema,
    name: z.string(),
    type: ActionTypeSchema,
    tier: ActionTierSchema,
    targets: ActionDefinitionTargetsSchema,
    costs: z.array(ResourceLossMechanicSchema),
    mechanics: z.array(MechanicSchema),
  })
  .superRefine(validateMechanicTargets)

/**
 * Requires that the action definition targets contain the necessary targets for every mechanic.
 */
function validateMechanicTargets(actionDefinition: ActionDefinition, context: z.RefinementCtx): void {
  for (const mechanic of [...actionDefinition.costs, ...actionDefinition.mechanics]) {
    for (const mechanicTarget of Object.values(mechanic.targets)) {
      const actionTarget = actionDefinition.targets[mechanicTarget.tag]
      if (actionTarget === undefined) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" is missing target slot "${mechanicTarget.tag}" required by the "${mechanic.type}" mechanic`,
        })
        validateSupportedConstraints(mechanicTarget.type, mechanicTarget.tag, mechanicTarget.constraints, context, actionDefinition.name)
        continue
      }

      if (actionTarget.type !== mechanicTarget.type) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" target slot "${mechanicTarget.tag}" has type "${actionTarget.type}", but the "${mechanic.type}" mechanic requires "${mechanicTarget.type}"`,
        })
      }

      validateSupportedConstraints(mechanicTarget.type, mechanicTarget.tag, mechanicTarget.constraints, context, actionDefinition.name)
    }
  }

  for (const [targetTag, actionTarget] of Object.entries(actionDefinition.targets)) {
    validateSupportedConstraints(actionTarget.type, targetTag, actionTarget.constraints, context, actionDefinition.name)
  }
}

function validateSupportedConstraints(
  targetType: ActionTargetDefinition["type"],
  targetTag: string,
  constraints: readonly TargetConstraint[],
  context: z.RefinementCtx,
  actionName: string,
): void {
  for (const constraint of constraints) {
    const implementation = getTargetConstraintImplementation(constraint)
    if (implementation.supportedTargetTypes.includes(targetType)) {
      continue
    }

    context.addIssue({
      code: "custom",
      message: `Action Definition "${actionName}" target slot "${targetTag}" has unsupported constraint "${constraint.type}" for target type "${targetType}"`,
    })
  }
}
