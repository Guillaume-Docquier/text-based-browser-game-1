import { branded } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
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
  const movementEffects = actionDefinition.effects.flatMap((effect, effectIndex) =>
    effect.type === FleetMoveEffectDefinition.type ? [{ effect, effectIndex }] : [],
  )
  const assaultEffects = actionDefinition.effects.flatMap((effect, effectIndex) =>
    effect.type === FleetAssaultEffectDefinition.type ? [{ effect, effectIndex }] : [],
  )
  const colonizeEffects = actionDefinition.effects.flatMap((effect, effectIndex) =>
    effect.type === FleetColonizeEffectDefinition.type ? [{ effect, effectIndex }] : [],
  )
  if (movementEffects.length > 1) {
    context.addIssue({ code: "custom", message: `Action Definition "${actionDefinition.name}" may contain only one FLEET_MOVE effect` })
  }
  if (assaultEffects.length > 1) {
    context.addIssue({ code: "custom", message: `Action Definition "${actionDefinition.name}" may contain only one FLEET_ASSAULT effect` })
  }
  if (colonizeEffects.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["effects"],
      message: `Action Definition "${actionDefinition.name}" may contain only one FLEET_COLONIZE effect`,
    })
  }

  const referencedInputTags = new Set<InputTag>()

  validateTargetConstraintSources({ actionDefinition, context })

  for (const { effect, effectIndex } of movementEffects)
    validateMovementMapping({ actionDefinition, context, effect, effectIndex, referencedInputTags })

  const movementEffect = movementEffects[0]?.effect
  for (const { effect, effectIndex } of assaultEffects)
    validateAssaultMapping({ actionDefinition, context, effect, effectIndex, movementEffect })

  for (const { effect, effectIndex } of colonizeEffects)
    validateColonizationMapping({ actionDefinition, context, effect, effectIndex, movementEffect })

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
      if (
        constraint.type !== "WITHIN_FLEET_RANGE" &&
        constraint.type !== "DIFFERENT_FROM_FLEET_ORIGIN" &&
        constraint.type !== AtFleetPlanetConstraint.type
      ) {
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

export function validateAssaultMapping({
  actionDefinition,
  context,
  effect,
  effectIndex,
  movementEffect,
}: {
  actionDefinition: ActionDefinition
  context: z.RefinementCtx
  effect: FleetAssaultEffectDefinition
  effectIndex: number
  movementEffect: FleetMoveEffectDefinition | undefined
}): void {
  const fleetTag = effect.targets.fleet.actionTargetTag
  const planetTag = effect.targets.planet.actionTargetTag
  const fleetDefinition = actionDefinition.targets[fleetTag]
  const planetDefinition = actionDefinition.targets[planetTag]
  const fleetConstraints = fleetDefinition?.constraints ?? []
  const planetConstraints = planetDefinition?.constraints ?? []

  if (!fleetConstraints.some((constraint) => constraint.type === OwnedBySubmittingPlayerConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["effects", effectIndex, "targets", "fleet"],
      message: `Action Definition "${actionDefinition.name}" Assault source slot "${fleetTag}" must require ownership by the submitting player`,
    })
  }
  if (!fleetConstraints.some((constraint) => constraint.type === StationaryFleetConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["effects", effectIndex, "targets", "fleet"],
      message: `Action Definition "${actionDefinition.name}" Assault source slot "${fleetTag}" must require a stationary Fleet`,
    })
  }

  if (movementEffect !== undefined) {
    if (movementEffect.targets.fleet.actionTargetTag !== fleetTag || movementEffect.targets.planet.actionTargetTag !== planetTag) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets"],
        message: `Action Definition "${actionDefinition.name}" FLEET_ASSAULT must use the same source and destination target tags as FLEET_MOVE`,
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
      message: `Action Definition "${actionDefinition.name}" standalone Assault target slot "${planetTag}" must require the selected Fleet's stationary Planet`,
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
  const planetTag = effect.targets.planet.actionTargetTag
  const fleetDefinition = actionDefinition.targets[fleetTag]
  const planetDefinition = actionDefinition.targets[planetTag]
  const fleetConstraints = fleetDefinition?.constraints ?? []
  const planetConstraints = planetDefinition?.constraints ?? []

  if (!fleetConstraints.some((constraint) => constraint.type === OwnedBySubmittingPlayerConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["effects", effectIndex, "targets", "fleet"],
      message: `Action Definition "${actionDefinition.name}" Colonize source slot "${fleetTag}" must require ownership by the submitting player`,
    })
  }
  if (!fleetConstraints.some((constraint) => constraint.type === StationaryFleetConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["effects", effectIndex, "targets", "fleet"],
      message: `Action Definition "${actionDefinition.name}" Colonize source slot "${fleetTag}" must require a stationary Fleet`,
    })
  }
  if (!planetConstraints.some((constraint) => constraint.type === UnclaimedPlanetConstraint.type)) {
    context.addIssue({
      code: "custom",
      path: ["targets", planetTag],
      message: `Action Definition "${actionDefinition.name}" Colonize target slot "${planetTag}" must require an unclaimed Planet`,
    })
  }

  if (movementEffect !== undefined) {
    if (movementEffect.targets.fleet.actionTargetTag !== fleetTag || movementEffect.targets.planet.actionTargetTag !== planetTag) {
      context.addIssue({
        code: "custom",
        path: ["effects", effectIndex, "targets"],
        message: `Action Definition "${actionDefinition.name}" FLEET_COLONIZE must use the same source and destination target tags as FLEET_MOVE`,
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
      message: `Action Definition "${actionDefinition.name}" standalone Colonize target slot "${planetTag}" must require the selected Fleet's stationary Planet`,
    })
  }
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
