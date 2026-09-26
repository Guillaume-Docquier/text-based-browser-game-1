import { z } from "zod"
import { type ActionDefinitionTargets, ActionDefinitionTargetsSchema } from "#lib/rules-engine/ruleset/actions/ActionDefinitionTargets.ts"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { MechanicSchema, type Mechanic } from "#lib/rules-engine/ruleset/mechanics/Mechanic.ts"

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
  targets: Readonly<ActionDefinitionTargets>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>

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
 * Requires an action definition target slot with a compatible type for every mechanic target.
 */
function validateMechanicTargets(actionDefinition: ActionDefinition, context: z.RefinementCtx): void {
  for (const mechanic of [...actionDefinition.costs, ...actionDefinition.mechanics]) {
    for (const mechanicTarget of Object.values(mechanic.targets)) {
      const slotTargetType = actionDefinition.targets[mechanicTarget.actionTargetTag]?.targetType
      if (slotTargetType === undefined) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" is missing target slot tagged "${mechanicTarget.actionTargetTag}" required by the "${mechanic.type}" mechanic`,
        })
      } else if (slotTargetType !== mechanicTarget.targetType) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" target slot tagged "${mechanicTarget.actionTargetTag}" has type "${slotTargetType}", but the "${mechanic.type}" mechanic requires "${mechanicTarget.targetType}"`,
        })
      }
    }
  }
}
