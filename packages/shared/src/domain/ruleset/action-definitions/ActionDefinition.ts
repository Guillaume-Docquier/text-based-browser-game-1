import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTierSchema, type ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionTypeSchema, type ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { InputDefinitionSchema, type InputDefinition } from "#shared/domain/ruleset/action-definitions/InputDefinition.ts"
import { InputTagSchema, type InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import { type TargetTag, TargetTagSchema } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { EffectDefinitionSchema, type EffectDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinition.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import {
  ResourceLossEffectDefinitionSchema,
  type ResourceLossEffectDefinition,
} from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { getFleetTargetDependency } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
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
    for (const reference of Object.values(effectDefinition.targets)) {
      const message = getEffectTargetCompatibilityIssue({
        actionName: actionDefinition.name,
        targets: actionDefinition.targets,
        effectType: effectDefinition.type,
        reference,
      })
      if (message !== undefined) context.addIssue({ code: "custom", message })
    }
  }
}

/**
 * Classifies one mapped effect reference and describes its missing or incompatible slot.
 */
function getEffectTargetCompatibilityIssue({
  actionName,
  targets,
  effectType,
  reference,
}: Readonly<{
  actionName: ActionDefinition["name"]
  targets: ActionDefinition["targets"]
  effectType: EffectDefinition["type"]
  reference: EffectDefinitionTargetDefinition
}>): string | undefined {
  const slotTargetType = targets[reference.actionTargetTag]?.targetType
  if (slotTargetType === undefined)
    return `Action Definition "${actionName}" is missing target slot tagged "${reference.actionTargetTag}" required by the "${effectType}" effect definition`
  if (slotTargetType !== reference.targetType)
    return `Action Definition "${actionName}" target slot tagged "${reference.actionTargetTag}" has type "${slotTargetType}", but the "${effectType}" effect definition requires "${reference.targetType}"`
  return undefined
}

type CompositionIssue = (message: string) => void
type MovementEffect = Extract<EffectDefinition, { type: "FLEET_MOVE" }>
type MovementComposition = Readonly<{
  action: ActionDefinition
  moves: MovementEffect[]
  issue: CompositionIssue
}>

function validateMovementComposition(action: ActionDefinition, context: z.RefinementCtx): void {
  const composition: MovementComposition = {
    action,
    moves: action.effects.filter((effect) => effect.type === "FLEET_MOVE"),
    issue: (message) => {
      context.addIssue({ code: "custom", message })
    },
  }
  validateAssaultComposition(composition)
  validateColonizationComposition(composition)
  if (composition.moves.length > 1) composition.issue("An Action supports at most one FLEET_MOVE")
  validateTargetDependencies(composition)
  validateInputReferences(composition)
  validateMoveDeclarations(composition)
}

function validateAssaultComposition({ action, moves, issue }: MovementComposition): void {
  for (const assault of action.effects.filter((effect) => effect.type === "ASSAULT"))
    validateSharedMovement(moves, assault.targets.fleet.actionTargetTag, assault.targets.planet.actionTargetTag, {
      effectName: "Assault",
      issue,
    })
}

function validateColonizationComposition(composition: MovementComposition): void {
  const { action, issue } = composition
  const colonizes = action.effects.filter((effect) => effect.type === "COLONIZE")
  if (colonizes.length > 1) issue("An Action supports at most one COLONIZE")
  for (const colonize of colonizes) validateColonizeDeclaration(composition, colonize)
}

function validateColonizeDeclaration(
  { action, moves, issue }: MovementComposition,
  colonize: Extract<EffectDefinition, { type: "COLONIZE" }>,
): void {
  const sourceTag = colonize.targets.fleet.actionTargetTag
  const destinationTag = colonize.targets.planet.actionTargetTag
  const source = action.targets[sourceTag]
  const destination = action.targets[destinationTag]
  validateFleetSourcePolicy(source, "Colonize", issue)
  if (destination?.constraints.some((c) => c.type === "UNCLAIMED_PLANET") !== true) issue("Colonize destination must be unclaimed")
  if (moves.length === 0) validateStationaryColonize(action, sourceTag, destination, issue)
  else validateSharedMovement(moves, sourceTag, destinationTag, { effectName: "Colonize", issue })
}

function validateTargetDependencies({ action, issue }: MovementComposition): void {
  for (const [tag, slot] of Object.entries(action.targets)) {
    for (const constraint of slot.constraints) {
      const dependency = getFleetTargetDependency(constraint)
      if (dependency !== undefined && action.targets[branded<TargetTag>(dependency)]?.targetType !== "FLEET")
        issue(`Target ${tag} references a missing or non-fleet source`)
    }
  }
}

function validateInputReferences({ action, moves, issue }: MovementComposition): void {
  const consumedTags = new Set(moves.map((move) => move.inputs.strength.actionInputTag))
  for (const [tag, input] of Object.entries(action.inputs)) {
    if (action.targets[input.fleetTargetTag]?.targetType !== "FLEET") issue(`Input ${tag} references a missing or non-fleet source`)
    if (!consumedTags.has(branded<InputTag>(tag))) issue(`Unused input ${tag}`)
  }
}

function validateMoveDeclarations({ action, moves, issue }: MovementComposition): void {
  for (const move of moves) {
    const sourceTag = move.targets.fleet.actionTargetTag
    const input = action.inputs[move.inputs.strength.actionInputTag]
    if (input?.fleetTargetTag !== sourceTag) issue("Movement strength input must reference its fleet source")
    const source = action.targets[sourceTag]
    validateFleetSourcePolicy(source, "Movement", issue)
    if (
      action.targets[move.targets.planet.actionTargetTag]?.constraints.some(
        (c) => c.type === "WITHIN_FLEET_RANGE" && c.fleetTargetTag === sourceTag,
      ) !== true
    )
      issue("Movement destination must declare a range from its source")
  }
}

function validateSharedMovement(
  moves: MovementEffect[],
  sourceTag: TargetTag,
  destinationTag: TargetTag,
  report: Readonly<{ effectName: "Assault" | "Colonize"; issue: CompositionIssue }>,
): void {
  if (moves.length !== 1 || !moves.every((move) => sharesMovementTargets(move, sourceTag, destinationTag)))
    report.issue(`${report.effectName} must share the source and destination of exactly one Move`)
}

function sharesMovementTargets(move: MovementEffect, sourceTag: TargetTag, destinationTag: TargetTag): boolean {
  return move.targets.fleet.actionTargetTag === sourceTag && move.targets.planet.actionTargetTag === destinationTag
}

function validateStationaryColonize(
  action: ActionDefinition,
  sourceTag: TargetTag,
  destination: TargetDefinition | undefined,
  issue: CompositionIssue,
): void {
  if (Object.keys(action.inputs).length !== 0) issue("Stationary Colonize has no inputs")
  if (destination?.constraints.some((c) => c.type === "AT_FLEET_PLANET" && c.fleetTargetTag === sourceTag) !== true)
    issue("Stationary Colonize destination must be at its source")
}

function validateFleetSourcePolicy(
  source: TargetDefinition | undefined,
  effectName: "Colonize" | "Movement",
  issue: CompositionIssue,
): void {
  const presentConstraints = new Set(source?.constraints.map((constraint) => constraint.type))
  for (const [constraint, message] of [
    ["OWNED_BY_SUBMITTING_PLAYER", "owned"],
    ["STATIONARY_FLEET", "stationary"],
  ] as const)
    if (!presentConstraints.has(constraint)) issue(`${effectName} source must be ${message}`)
}
