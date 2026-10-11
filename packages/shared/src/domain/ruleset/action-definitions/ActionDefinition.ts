import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTierSchema, type ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { InputDefinitionSchema, type InputDefinition } from "#shared/domain/ruleset/action-definitions/InputDefinition.ts"
import { InputTagSchema, type InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { type TargetTag, TargetTagSchema } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { EffectDefinitionSchema, type EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import {
  ResourceLossEffectDefinitionSchema,
  type ResourceLossEffectDefinition,
} from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"

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
  inputs: Readonly<Record<InputTag, InputDefinition>>
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
    inputs: z.record(InputTagSchema, InputDefinitionSchema),
    targets: z.record(TargetTagSchema, TargetDefinitionSchema),
    costs: z.array(ResourceLossEffectDefinitionSchema),
    effects: z.array(EffectDefinitionSchema),
  })
  .superRefine(validateEffectDefinitionTargets)
  .superRefine(validateMovementComposition) satisfies z.ZodType<ActionDefinition>

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

function validateMovementComposition(action: ActionDefinition, context: z.RefinementCtx): void {
  const issue = (message: string): void => {
    context.addIssue({ code: "custom", message })
  }
  const moves = action.effects.filter((effect) => effect.type === "FLEET_MOVE")
  for (const assault of action.effects.filter((effect) => effect.type === "ASSAULT")) {
    const move = moves[0]
    if (
      moves.length !== 1 ||
      move === undefined ||
      assault.targets.fleet.actionTargetTag !== move.targets.fleet.actionTargetTag ||
      assault.targets.planet.actionTargetTag !== move.targets.planet.actionTargetTag
    )
      issue("Assault must share the source and destination of exactly one Move")
  }
  if (moves.length > 1) issue("An Action supports at most one FLEET_MOVE")
  for (const [tag, slot] of Object.entries(action.targets)) {
    for (const constraint of slot.constraints) {
      if (constraint.type === "WITHIN_FLEET_RANGE" && action.targets[constraint.fleetTargetTag]?.targetType !== "FLEET")
        issue(`Target ${tag} references a missing or non-fleet source`)
    }
  }
  for (const [tag, input] of Object.entries(action.inputs)) {
    if (action.targets[input.fleetTargetTag]?.targetType !== "FLEET") issue(`Input ${tag} references a missing or non-fleet source`)
    if (!moves.some((move) => move.inputs.strength.actionInputTag === tag)) issue(`Unused input ${tag}`)
  }
  for (const move of moves) {
    const sourceTag = move.targets.fleet.actionTargetTag
    const input = action.inputs[move.inputs.strength.actionInputTag]
    if (input?.fleetTargetTag !== sourceTag) issue("Movement strength input must reference its fleet source")
    const source = action.targets[sourceTag]
    if (source?.constraints.some((c) => c.type === "OWNED_BY_SUBMITTING_PLAYER") !== true) issue("Movement source must be owned")
    if (source?.constraints.some((c) => c.type === "STATIONARY_FLEET") !== true) issue("Movement source must be stationary")
    if (
      action.targets[move.targets.planet.actionTargetTag]?.constraints.some(
        (c) => c.type === "WITHIN_FLEET_RANGE" && c.fleetTargetTag === sourceTag,
      ) !== true
    )
      issue("Movement destination must declare a range from its source")
  }
}
