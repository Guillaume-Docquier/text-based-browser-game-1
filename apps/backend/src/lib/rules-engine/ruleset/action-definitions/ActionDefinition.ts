import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#lib/db/rulesets/ActionDefinitionId.ts"
import { ActionTierSchema, type ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { type TargetTag, TargetTagSchema } from "#lib/rules-engine/ruleset/action-definitions/TargetTag.ts"
import { EffectDefinitionSchema, type EffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/EffectDefinition.ts"
import {
  ResourceLossEffectDefinitionSchema,
  type ResourceLossEffectDefinition,
} from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#lib/rules-engine/ruleset/target-definitions/TargetDefinition.ts"

/**
 * The definition of an Action.
 */
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
  costs: ResourceLossEffectDefinition[]
  effects: EffectDefinition[]
}>

export const ActionDefinitionSchema = z
  .object({
    id: ActionDefinitionIdSchema,
    name: z.string(),
    type: ActionTypeSchema,
    tier: ActionTierSchema,
    targets: z.record(TargetTagSchema, TargetDefinitionSchema),
    costs: z.array(ResourceLossEffectDefinitionSchema),
    effects: z.array(EffectDefinitionSchema),
  })
  .superRefine(validateEffectDefinitionTargets) satisfies z.ZodType<ActionDefinition>

/**
 * Requires an action definition target slot with a compatible type for every effect definition target.
 */
function validateEffectDefinitionTargets(actionDefinition: ActionDefinition, context: z.RefinementCtx): void {
  for (const effectDefinition of [...actionDefinition.costs, ...actionDefinition.effects]) {
    for (const effectDefinitionTarget of Object.values(effectDefinition.targets)) {
      const slotTargetType = actionDefinition.targets[effectDefinitionTarget.actionTargetTag]?.targetType
      if (slotTargetType === undefined) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" is missing target slot tagged "${effectDefinitionTarget.actionTargetTag}" required by the "${effectDefinition.type}" effect definition`,
        })
      } else if (slotTargetType !== effectDefinitionTarget.targetType) {
        context.addIssue({
          code: "custom",
          message: `Action Definition "${actionDefinition.name}" target slot tagged "${effectDefinitionTarget.actionTargetTag}" has type "${slotTargetType}", but the "${effectDefinition.type}" effect definition requires "${effectDefinitionTarget.targetType}"`,
        })
      }
    }
  }
}
