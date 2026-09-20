import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import { SubmittedActionValidationError } from "#lib/rules-engine/action-submission/validation/SubmittedActionValidationError.ts"
import type { ActionTargetDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionTargetDefinition.ts"
import { getEffectiveTargetConstraints } from "#lib/rules-engine/ruleset-model/actions/effectiveTargetConstraints.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { ResolvedTarget } from "#lib/rules-engine/ruleset-model/target-constraints/ResolvedTarget.ts"
import { getTargetConstraintImplementation } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraintRegistry.ts"
import type { Planet, TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

type TargetToEvaluate = Readonly<{
  submittedAction: SubmittedAction
  actionDefinition: Ruleset["actionDefinitions"][string]
  targetTag: string
  target: ResolvedTarget
}>

/**
 * Validates that the target slots for the action submission are filled and valid.
 */
export function validateTargets(
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
): Result<SubmittedActionIssue[], SubmittedActionValidationError> {
  const issues: SubmittedActionIssue[] = []
  const targetsToEvaluate: TargetToEvaluate[] = []

  for (const submittedAction of submittedActions) {
    const actionDefinition = ruleset.actionDefinitions[submittedAction.actionDefinitionId]
    if (actionDefinition === undefined) {
      // The action-definition validator owns this ordinary submission issue. There is
      // no target definition to validate here, so leave it for that validator.
      continue
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
      const targetResult = validateTargetDefinition(actionDefinition.targets[targetSlot], targetSlot, targetId, turnState)
      if (Result.isFailure(targetResult)) {
        issues.push(
          SubmittedActionIssue.create({
            issue: targetResult.error,
            submittedAction,
            actionDefinitionName: actionDefinition.name,
          }),
        )
        continue
      }

      targetsToEvaluate.push({
        submittedAction,
        actionDefinition,
        targetTag: targetSlot,
        target: targetResult.value,
      })
    }
  }

  for (const { submittedAction, actionDefinition, targetTag, target } of targetsToEvaluate) {
    for (const constraint of getEffectiveTargetConstraints(actionDefinition, targetTag)) {
      const evaluationResult = getTargetConstraintImplementation(constraint).evaluate({
        constraint,
        target,
        targetTag,
        submittingPlayerId: submittedAction.playerId,
        turnState,
        referenceTargets: {},
      })

      if (Result.isFailure(evaluationResult)) {
        return Result.Failure(
          SubmittedActionValidationError.create({
            submittedActionId: submittedAction.id,
            actionDefinitionId: submittedAction.actionDefinitionId,
            targetTag,
            message: `Could not evaluate target constraint "${constraint.type}" for target slot "${targetTag}" on submitted action "${submittedAction.id}": ${evaluationResult.error.message}`,
            cause: evaluationResult.error,
          }),
        )
      }

      issues.push(
        ...evaluationResult.value.map(({ issue }) =>
          SubmittedActionIssue.create({
            issue,
            submittedAction,
            actionDefinitionName: actionDefinition.name,
          }),
        ),
      )
    }
  }

  return Result.Success(issues)
}

function validateTargetDefinition(
  targetDefinition: ActionTargetDefinition | undefined,
  targetSlot: string,
  targetId: string,
  turnState: ReadonlyDeep<TurnState>,
): Result<ResolvedTarget, string> {
  if (targetDefinition === undefined) {
    return Result.Failure(`Unexpected target slot "${targetSlot}"`)
  }

  const targetType = targetDefinition.type

  if (targetId.length === 0) {
    return Result.Failure(`Target slot "${targetSlot}" must be set to a ${targetType} id`)
  }

  switch (targetType) {
    case TargetType.PLAYER:
      return resolvePlayerTarget(turnState, targetSlot, targetId)
    case TargetType.FLEET:
      return resolveFleetTarget(turnState, targetSlot, targetId)
    case TargetType.PLANET:
      return resolvePlanetTarget(turnState, targetSlot, targetId)
  }
}

function resolvePlayerTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<ResolvedTarget, string> {
  const player = turnState.players[branded<PlayerId>(targetId)]
  if (player === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Player id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.PLAYER, entity: player })
}

function resolveFleetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<ResolvedTarget, string> {
  const fleet = turnState.fleets[branded<FleetId>(targetId)]
  if (fleet === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Fleet id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.FLEET, entity: fleet })
}

function resolvePlanetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): Result<ResolvedTarget, string> {
  const planet = getPlanet(turnState, targetId)
  if (planet === undefined) {
    return Result.Failure(`Target slot "${targetSlot}" references unknown Planet id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.PLANET, entity: planet })
}

/**
 * This is O(1)
 */
function getPlanet(turnState: TurnState, targetId: string): Planet | undefined {
  return turnState.planets[branded<PlanetId>(Number(targetId))]
}
