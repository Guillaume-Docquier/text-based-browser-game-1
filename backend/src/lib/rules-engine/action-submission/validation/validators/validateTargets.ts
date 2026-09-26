import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import { evaluateOwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/action-submission/validation/validators/target-constraints/evaluateOwnedBySubmittingPlayerConstraint.ts"
import type {
  TargetConstraintError,
  TargetConstraintIssue,
} from "#lib/rules-engine/action-submission/validation/validators/target-constraints/TargetConstraintEvaluator.ts"
import type { TargetTag } from "#lib/rules-engine/ruleset/actions/TargetTag.ts"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import type { TargetConstraint } from "#lib/rules-engine/ruleset/target-constraints/TargetConstraint.ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset/target-constraints/TargetDefinition.ts"
import type { TargetId } from "#lib/rules-engine/ruleset/target-constraints/TargetId.ts"
import type {
  TargetableEntity,
  TargetableFleet,
  TargetablePlanet,
  TargetablePlayer,
} from "#lib/rules-engine/turn-resolution/TargetableEntity.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Validates selections for every Action Definition target slot against its type and constraints.
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

    const missingTargetTags = Object.keys(actionDefinition.targets).filter(
      // Object.keys widens TargetTag to string
      (targetTag) => submittedAction.selectedTargets[branded<TargetTag>(targetTag)] === undefined,
    )
    for (const missingTargetTag of missingTargetTags) {
      issues.push(
        SubmittedActionIssue.create({
          issue: `Missing target selection for tag "${missingTargetTag}"`,
          submittedAction,
          actionDefinitionName: actionDefinition.name,
        }),
      )
    }

    for (const [targetTag, targetId] of Object.entries(submittedAction.selectedTargets)) {
      const brandedTargetTag = branded<TargetTag>(targetTag)
      const issue = validateTargetSelection(
        actionDefinition.targets[brandedTargetTag],
        brandedTargetTag,
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

function validateTargetSelection(
  targetDefinition: TargetDefinition | undefined,
  targetTag: TargetTag,
  targetId: TargetId,
  submittingPlayerId: PlayerId,
  turnState: ReadonlyDeep<TurnState>,
): string | null {
  if (targetDefinition === undefined) {
    return `Unexpected target tag "${targetTag}"`
  }

  if (targetId.length === 0) {
    return `Target selection for tag "${targetTag}" must be a ${targetDefinition.targetType} id`
  }

  const targetResult = getTarget({ targetType: targetDefinition.targetType, turnState, targetTag, targetId })
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
  targetTag,
  targetId,
}: {
  targetType: TargetType
  turnState: ReadonlyDeep<TurnState>
  targetTag: TargetTag
  targetId: TargetId
}): Result<TargetableEntity, string> {
  switch (targetType) {
    case TargetType.PLAYER:
      return getPlayerTarget(turnState, targetTag, targetId)
    case TargetType.FLEET:
      return getFleetTarget(turnState, targetTag, targetId)
    case TargetType.PLANET:
      return getPlanetTarget(turnState, targetTag, targetId)
  }
}

function getPlayerTarget(turnState: ReadonlyDeep<TurnState>, targetTag: TargetTag, targetId: string): Result<TargetablePlayer, string> {
  const player = turnState.players[branded<PlayerId>(targetId)]
  if (player === undefined) {
    return Result.Failure(`Target selected for tag "${targetTag}" references unknown Player id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.PLAYER, ...player })
}

function getFleetTarget(turnState: ReadonlyDeep<TurnState>, targetTag: TargetTag, targetId: string): Result<TargetableFleet, string> {
  const fleet = turnState.fleets[branded<FleetId>(targetId)]
  if (fleet === undefined) {
    return Result.Failure(`Target selected for tag "${targetTag}" references unknown Fleet id "${targetId}"`)
  }

  return Result.Success({ type: TargetType.FLEET, ...fleet })
}

function getPlanetTarget(turnState: ReadonlyDeep<TurnState>, targetTag: TargetTag, targetId: string): Result<TargetablePlanet, string> {
  const planet = turnState.planets[branded<PlanetId>(targetId)]
  if (planet === undefined) {
    return Result.Failure(`Target selected for tag "${targetTag}" references unknown Planet id "${targetId}"`)
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
      return evaluateOwnedBySubmittingPlayerConstraint({ constraint, submittingPlayerId, target })
  }
}
