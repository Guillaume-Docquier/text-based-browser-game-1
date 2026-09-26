import { z } from "zod"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { type TargetTag, TargetTagSchema } from "#lib/rules-engine/ruleset/action-definitions/TargetTag.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossMechanic.ts"
import { MechanicSchema, type Mechanic } from "#lib/rules-engine/ruleset/effect-definitions/Mechanic.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#lib/rules-engine/ruleset/target-definitions/TargetDefinition.ts"

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
  targets: Readonly<Record<TargetTag, TargetDefinition>>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>

export const ActionDefinitionSchema = z
  .object({
    id: ActionDefinitionIdSchema,
    name: z.string(),
    type: ActionTypeSchema,
    tier: ActionTierSchema,
    targets: z.record(TargetTagSchema, TargetDefinitionSchema),
    costs: z.array(ResourceLossMechanicSchema),
    mechanics: z.array(MechanicSchema),
  })
  .superRefine(validateMechanicTargets) satisfies z.ZodType<ActionDefinition>

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
