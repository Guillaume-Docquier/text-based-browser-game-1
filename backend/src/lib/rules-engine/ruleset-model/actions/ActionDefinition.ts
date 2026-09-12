import { z } from "zod"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { MechanicSchema, type Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"
import { targetTypeSatisfies, type TargetType, TargetTypeSchema } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

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
   * Maps target tags to the type accepted by each target slot.
   */
  targets: Readonly<Record<string, TargetType>>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>

export const ActionDefinitionTargetsSchema = z.record(z.string(), TargetTypeSchema).readonly() satisfies z.ZodType<
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
      const actionTargetType = actionDefinition.targets[mechanicTarget.tag]
      if (actionTargetType === undefined) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" is missing target slot "${mechanicTarget.tag}" required by the "${mechanic.type}" mechanic`,
        })
      } else if (!targetTypeSatisfies({ provided: actionTargetType, required: mechanicTarget.type })) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" target slot "${mechanicTarget.tag}" has type "${actionTargetType}", but the "${mechanic.type}" mechanic requires "${mechanicTarget.type}"`,
        })
      }
    }
  }
}
