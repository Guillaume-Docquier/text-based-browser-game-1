import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionInputDefinitionSchema, type ActionInputDefinition } from "#shared/domain/ruleset/action-definitions/ActionInputDefinition.ts"
import { ActionTierSchema, type ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { InputTagSchema, type InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { type TargetTag, TargetTagSchema } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { EffectDefinitionSchema, type EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import {
  ResourceLossEffectDefinitionSchema,
  type ResourceLossEffectDefinition,
} from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { type TargetDefinition, TargetDefinitionSchema } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

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
  inputs: Readonly<Record<InputTag, ActionInputDefinition>>
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
    inputs: z.record(InputTagSchema, ActionInputDefinitionSchema),
    targets: z.record(TargetTagSchema, TargetDefinitionSchema),
    costs: z.array(ResourceLossEffectDefinitionSchema),
    effects: z.array(EffectDefinitionSchema),
  })
  .superRefine(validateEffectDefinitionTargets)
  .superRefine(validateMovementMappings) satisfies z.ZodType<ActionDefinition>

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

/**
 * Checks cross-slot and input mappings required for configured Fleet Movement.
 */
function validateMovementMappings(actionDefinition: ActionDefinition, context: z.RefinementCtx): void {
  const movementEffects = actionDefinition.effects.filter((effect) => effect.type === FleetMoveEffectDefinition.type)
  if (movementEffects.length > 1) {
    context.addIssue({ code: "custom", message: `Action Definition "${actionDefinition.name}" may contain only one FLEET_MOVE effect` })
  }

  const referencedInputTags = new Set<InputTag>()

  for (const [targetTag, targetDefinition] of Object.entries(actionDefinition.targets)) {
    for (const [constraintIndex, constraint] of targetDefinition.constraints.entries()) {
      if (constraint.type !== "WITHIN_FLEET_RANGE" && constraint.type !== "DIFFERENT_FROM_FLEET_ORIGIN") {
        continue
      }

      const sourceFleetTag = constraint.references.sourceFleetTag
      const sourceDefinition = actionDefinition.targets[sourceFleetTag]
      if (sourceDefinition === undefined) {
        context.addIssue({
          code: "custom",
          path: ["targets", targetTag, "constraints", constraintIndex],
          message: `Constraint "${constraint.type}" references missing source Fleet slot "${sourceFleetTag}"`,
        })
      } else if (sourceDefinition.targetType !== TargetType.FLEET) {
        context.addIssue({
          code: "custom",
          path: ["targets", targetTag, "constraints", constraintIndex],
          message: `Constraint "${constraint.type}" source slot "${sourceFleetTag}" must be a FLEET target`,
        })
      }
    }
  }

  for (const [effectIndex, effect] of movementEffects.entries()) {
    const fleetTag = effect.targets.fleet.actionTargetTag
    const planetTag = effect.targets.planet.actionTargetTag
    const fleetDefinition = actionDefinition.targets[fleetTag]
    const planetDefinition = actionDefinition.targets[planetTag]
    const fleetConstraints = fleetDefinition?.constraints ?? []
    const planetConstraints = planetDefinition?.constraints ?? []
    const strengthInputTag = effect.inputs.strength.actionInputTag

    if (!fleetConstraints.some((constraint) => constraint.type === OwnedBySubmittingPlayerConstraint.type)) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets", "fleet"],
        message: `Action Definition "${actionDefinition.name}" Fleet source slot "${fleetTag}" must require ownership by the submitting player`,
      })
    }
    if (!fleetConstraints.some((constraint) => constraint.type === StationaryFleetConstraint.type)) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets", "fleet"],
        message: `Action Definition "${actionDefinition.name}" Fleet source slot "${fleetTag}" must require a stationary Fleet`,
      })
    }
    if (
      !planetConstraints.some((constraint) => constraint.type === "WITHIN_FLEET_RANGE" && constraint.references.sourceFleetTag === fleetTag)
    ) {
      context.addIssue({
        code: "custom",
        path: ["targets", planetTag],
        message: `Action Definition "${actionDefinition.name}" destination slot "${planetTag}" must constrain range from Fleet slot "${fleetTag}"`,
      })
    }
    if (
      !planetConstraints.some(
        (constraint) => constraint.type === "DIFFERENT_FROM_FLEET_ORIGIN" && constraint.references.sourceFleetTag === fleetTag,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["targets", planetTag],
        message: `Action Definition "${actionDefinition.name}" destination slot "${planetTag}" must differ from Fleet slot "${fleetTag}" origin`,
      })
    }

    referencedInputTags.add(strengthInputTag)
    const inputDefinition = actionDefinition.inputs[strengthInputTag]
    if (inputDefinition === undefined) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "inputs", "strength"],
        message: `Action Definition "${actionDefinition.name}" is missing input slot "${strengthInputTag}" required by FLEET_MOVE`,
      })
    } else if (inputDefinition.type !== effect.inputs.strength.inputType) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "inputs", "strength"],
        message: `Action Definition "${actionDefinition.name}" input slot "${strengthInputTag}" must use type "${String(effect.inputs.strength.inputType)}"`,
      })
    }
  }

  for (const inputTag of Object.keys(actionDefinition.inputs)) {
    const brandedInputTag = branded<InputTag>(inputTag)
    if (!referencedInputTags.has(brandedInputTag)) {
      context.addIssue({
        code: "custom",
        path: ["inputs", inputTag],
        message: `Action Definition "${actionDefinition.name}" input slot "${inputTag}" is not used by an Effect Definition`,
      })
    }
  }
}
