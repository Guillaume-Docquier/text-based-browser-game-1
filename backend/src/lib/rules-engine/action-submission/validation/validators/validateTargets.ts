import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import type { ActionTargetDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionTargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"
import type {
  TargetConstraintError,
  TargetConstraintIssue,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintEvaluator.ts"
import type {
  TargetableEntity,
  TargetableFleet,
  TargetablePlanet,
  TargetablePlayer,
} from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Validates that the target slots for the action submission are filled and valid.
 */
export function validateTargets(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): Result<SubmittedActionIssue[], string> {
  const issues: SubmittedActionIssue[] = []

  for (const submittedAction of submittedActions) {
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    if (actionDefinition === undefined) {
      return Result.Failure(
        `Cannot validate targets for action submission ${submittedAction.id}, there is no action definition ${submittedAction.actionDefinitionId}`,
      )
    }

    const missingTargetSlots = Object.keys(actionDefinition.targets).filter(
      (targetSlot) => submittedAction.selectedTargets[targetSlot] === undefined,
    )
    for (const missingTargetSlot of missingTargetSlots) {
      issues.push(
        SubmittedActionIssue.create({
          issue: `Missing target slot "${missingTargetSlot}"`,
          submittedAction,
          actionDefinitionName: actionDefinition.name,
        }),
      )
    }

    for (const [targetSlot, targetId] of Object.entries(submittedAction.selectedTargets)) {
      const issue = validateTargetDefinition(
        actionDefinition.targets[targetSlot],
        targetSlot,
        targetId,
        submittedAction.playerId,
        turnState,
      )
      if (issue !== null) {
        issues.push(
          SubmittedActionIssue.create({
            issue,
            submittedAction,
            actionDefinitionName: actionDefinition.name,
          }),
        )
      }
    }
  }

  return Result.Success(issues)
}

function validateTargetDefinition(
  targetDefinition: ActionTargetDefinition | undefined,
  targetSlot: string,
  targetId: string,
  submittingPlayerId: PlayerId,
  turnState: ReadonlyDeep<TurnState>,
): string | null {
  if (targetDefinition === undefined) {
    return `Unexpected target slot "${targetSlot}"`
  }

  if (targetId.length === 0) {
    return `Target slot "${targetSlot}" must be set to a ${targetDefinition.targetType} id`
  }

  const targetResult = getTarget({ targetType: targetDefinition.targetType, turnState, targetSlot, targetId })
  if (Result.isFailure(targetResult)) {
    return targetResult.error
  }

  for (const constraint of targetDefinition.constraints) {
    const constraintValidationResult = validateConstraint({ constraint, submittingPlayerId, target: targetResult.value })
    if (Result.isFailure(constraintValidationResult)) {
      return constraintValidationResult.error.error
    }

    if (constraintValidationResult.value !== undefined) {
      return constraintValidationResult.value
    }
  }

  return null
}

function getTarget({
  targetType,
  turnState,
  targetSlot,
  targetId,
}: {
  targetType: TargetType
  turnState: ReadonlyDeep<TurnState>
  targetSlot: string
  targetId: string
}): Result<TargetableEntity, string> {
  switch (targetType) {
    case TargetType.PLAYER:
      return getPlayerTarget(turnState, targetSlot, targetId)
    case TargetType.FLEET:
      return getFleetTarget(turnState, targetSlot, targetId)
    case TargetType.PLANET:
      return getPlanetTarget(turnState, targetSlot, targetId)
  }
}

function getPlayerTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<TargetablePlayer, string> {
  const player = turnState.players[branded<PlayerId>(targetId)]
  if (player === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Player id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.PLAYER, ...player })
}

function getFleetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<TargetableFleet, string> {
  const fleet = turnState.fleets[branded<FleetId>(targetId)]
  if (fleet === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Fleet id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.FLEET, ...fleet })
}

function getPlanetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<TargetablePlanet, string> {
  const planet = turnState.planets[branded<PlanetId>(Number(targetId))]
  if (planet === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Planet id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.PLANET, ...planet })
}

function validateConstraint({
  constraint,
  submittingPlayerId,
  target,
}: {
  constraint: TargetConstraint
  submittingPlayerId: PlayerId
  target: TargetableEntity
}): Result<TargetConstraintIssue, TargetConstraintError> {
  switch (constraint.type) {
    case OwnedBySubmittingPlayerConstraint.type:
      return OwnedBySubmittingPlayerConstraint.evaluate({ constraint, submittingPlayerId, target })
  }
}
