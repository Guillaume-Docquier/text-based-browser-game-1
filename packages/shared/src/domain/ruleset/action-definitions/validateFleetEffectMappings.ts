import { branded } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { AtFleetPlanetConstraint } from "#shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "#shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import type { ActionDefinition } from "./ActionDefinition.ts"

export function validateFleetEffectMappings(actionDefinition: ActionDefinition, context: z.RefinementCtx): void {
  const movementEffects = fleetEffects(actionDefinition, FleetMoveEffectDefinition.type)
  const assaultEffects = fleetEffects(actionDefinition, FleetAssaultEffectDefinition.type)
  const colonizeEffects = fleetEffects(actionDefinition, FleetColonizeEffectDefinition.type)
  validateMultiplicity(actionDefinition, context, movementEffects.length, FleetMoveEffectDefinition.type)
  validateMultiplicity(actionDefinition, context, assaultEffects.length, FleetAssaultEffectDefinition.type)
  validateMultiplicity(actionDefinition, context, colonizeEffects.length, FleetColonizeEffectDefinition.type)
  const referencedInputTags = new Set<InputTag>()

  validateTargetConstraintSources({ actionDefinition, context })

  for (const { effect, effectIndex } of movementEffects) {
    validateMovementMapping({ actionDefinition, context, effect, effectIndex, referencedInputTags })
  }

  const movementEffect = movementEffects[0]?.effect
  for (const { effect, effectIndex } of assaultEffects) {
    validateAssaultSourceAndArrival({ actionDefinition, context, effect, effectIndex, movementEffect, label: "Assault" })
  }

  for (const { effect, effectIndex } of colonizeEffects) {
    validateColonizationMapping({ actionDefinition, context, effect, effectIndex, movementEffect })
  }

  validateReferencedInputs({ actionDefinition, context, referencedInputTags })
}

export function validateTargetConstraintSources({
  actionDefinition,
  context,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
}): void {
  for (const [targetTag, targetDefinition] of Object.entries(actionDefinition.targets)) {
    for (const [constraintIndex, constraint] of targetDefinition.constraints.entries()) {
      if (!isFleetReferenceConstraint(constraint)) {
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
}

export function validateMovementMapping({
  actionDefinition,
  context,
  effect,
  effectIndex,
  referencedInputTags,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  effect: FleetMoveEffectDefinition
  effectIndex: number
  referencedInputTags: Set<InputTag>
}): void {
  const fleetTag = effect.targets.fleet.actionTargetTag
  validateFleetSource({ actionDefinition, context, effectIndex, fleetTag, label: "Fleet" })
  const planetTag = effect.targets.planet.actionTargetTag
  const planetDefinition = actionDefinition.targets[planetTag]
  const planetConstraints = planetDefinition?.constraints ?? []

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

  validateMovementStrengthInput({ actionDefinition, context, effect, effectIndex, referencedInputTags })
}
function validateMovementStrengthInput({
  actionDefinition,
  context,
  effect,
  effectIndex,
  referencedInputTags,
}: Parameters<typeof validateMovementMapping>[0]): void {
  const strengthInputTag = effect.inputs.strength.actionInputTag
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

export function validateColonizationMapping({
  actionDefinition,
  context,
  effect,
  effectIndex,
  movementEffect,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  effect: FleetColonizeEffectDefinition
  effectIndex: number
  movementEffect: FleetMoveEffectDefinition | undefined
}): void {
  const fleetTag = effect.targets.fleet.actionTargetTag
  validateFleetSource({ actionDefinition, context, effectIndex, fleetTag, label: "Colonize" })
  const planetTag = effect.targets.planet.actionTargetTag
  const planetDefinition = actionDefinition.targets[planetTag]
  const planetConstraints = planetDefinition?.constraints ?? []

  if (!planetConstraints.some((constraint) => constraint.type === UnclaimedPlanetConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["targets", planetTag],
      message: `Action Definition "${actionDefinition.name}" Colonize target slot "${planetTag}" must require an unclaimed Planet`,
    })
  }

  validateArrivalMapping({ actionDefinition, context, effect, effectIndex, movementEffect, label: "Colonize" })
}

export function validateReferencedInputs({
  actionDefinition,
  context,
  referencedInputTags,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  referencedInputTags: Set<InputTag>
}): void {
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

function fleetEffects<T extends EffectDefinition["type"]>(
  actionDefinition: ActionDefinition,
  type: T,
): Array<{ effect: Extract<EffectDefinition, { type: T }>; effectIndex: number }> {
  return actionDefinition.effects
    .map((effect, effectIndex) => ({ effect, effectIndex }))
    .filter((entry): entry is { effect: Extract<EffectDefinition, { type: T }>; effectIndex: number } => entry.effect.type === type)
}
function validateMultiplicity(
  actionDefinition: ActionDefinition,
  context: z.RefinementCtx,
  count: number,
  type: EffectDefinition["type"],
): void {
  if (count <= 1) {
    return
  }
  context.addIssue({
    code: "custom",
    ...(type === FleetColonizeEffectDefinition.type ? { path: ["effects"] } : {}),
    message: `Action Definition "${actionDefinition.name}" may contain only one ${type} effect`,
  })
}
function validateFleetSource({
  actionDefinition,
  context,
  effectIndex,
  fleetTag,
  label,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  effectIndex: number
  fleetTag: TargetTag
  label: "Fleet" | "Assault" | "Colonize"
}): void {
  const constraints = actionDefinition.targets[fleetTag]?.constraints ?? []
  const requirements = [
    { type: OwnedBySubmittingPlayerConstraint.type, description: "ownership by the submitting player" },
    { type: StationaryFleetConstraint.type, description: "a stationary Fleet" },
  ]
  for (const requirement of requirements) {
    if (!constraints.some((constraint) => constraint.type === requirement.type)) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets", "fleet"],
        message: `Action Definition "${actionDefinition.name}" ${label} source slot "${fleetTag}" must require ${requirement.description}`,
      })
    }
  }
}

function validateArrivalMapping({
  actionDefinition,
  context,
  effect,
  effectIndex,
  movementEffect,
  label,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  effect: FleetAssaultEffectDefinition | FleetColonizeEffectDefinition
  effectIndex: number
  movementEffect: FleetMoveEffectDefinition | undefined
  label: "Assault" | "Colonize"
}): void {
  const fleetTag = effect.targets.fleet.actionTargetTag
  const planetTag = effect.targets.planet.actionTargetTag
  const planetDefinition = actionDefinition.targets[planetTag]
  const planetConstraints = planetDefinition?.constraints ?? []

  if (movementEffect !== undefined) {
    if (movementEffect.targets.fleet.actionTargetTag !== fleetTag || movementEffect.targets.planet.actionTargetTag !== planetTag) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets"],
        message: `Action Definition "${actionDefinition.name}" ${effect.type} must use the same source and destination target tags as FLEET_MOVE`,
      })
    }
  } else if (
    !planetConstraints.some(
      (constraint) => constraint.type === AtFleetPlanetConstraint.type && constraint.references.sourceFleetTag === fleetTag,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["targets", planetTag],
      message: `Action Definition "${actionDefinition.name}" standalone ${label} target slot "${planetTag}" must require the selected Fleet's stationary Planet`,
    })
  }
}
function validateAssaultSourceAndArrival(options: Parameters<typeof validateArrivalMapping>[0]): void {
  validateFleetSource({
    actionDefinition: options.actionDefinition,
    context: options.context,
    effectIndex: options.effectIndex,
    fleetTag: options.effect.targets.fleet.actionTargetTag,
    label: options.label,
  })
  validateArrivalMapping(options)
}

type ActionTargetConstraint = ActionDefinition["targets"][TargetTag]["constraints"][number]
type FleetReferenceConstraint = Extract<
  ActionTargetConstraint,
  { type: "WITHIN_FLEET_RANGE" | "DIFFERENT_FROM_FLEET_ORIGIN" | "AT_FLEET_PLANET" }
>
function isFleetReferenceConstraint(constraint: ActionTargetConstraint): constraint is FleetReferenceConstraint {
  const types: ReadonlyArray<ActionTargetConstraint["type"]> = ["WITHIN_FLEET_RANGE", "DIFFERENT_FROM_FLEET_ORIGIN", "AT_FLEET_PLANET"]
  return types.includes(constraint.type)
}
