import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import { SubmittedActionIssue } from "#game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { TargetForValidation } from "#game-rules/action-submission/validation/validators/target-constraints/TargetConstraintEvaluator.ts"
import { validateTarget } from "#game-rules/action-submission/validation/validators/validateTarget.ts"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import type { ActionDefinition } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "#game-rules/ruleset/action-definitions/TargetTag.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"
import type { TurnState } from "#game-rules/turn-resolution/TurnState.ts"

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

    for (const issue of validateAction(submittedAction, actionDefinition, turnState)) {
      issues.push(SubmittedActionIssue.create({ issue, submittedAction, actionDefinitionName: actionDefinition.name }))
    }
  }

  return Result.Success(issues)
}

function validateAction(
  submittedAction: SubmittedAction,
  actionDefinition: ActionDefinition,
  turnState: ReadonlyDeep<TurnState>,
): string[] {
  const issues: string[] = []

  for (const targetTag of Object.keys(actionDefinition.targets)) {
    // Object.keys widens TargetTag to string.
    if (submittedAction.selectedTargets[branded<TargetTag>(targetTag)] === undefined) {
      issues.push(`Missing target selection for tag "${targetTag}"`)
    }
  }

  for (const [targetTag, targetId] of Object.entries(submittedAction.selectedTargets)) {
    const brandedTargetTag = branded<TargetTag>(targetTag)
    const targetDefinition = actionDefinition.targets[brandedTargetTag]
    if (targetDefinition === undefined) {
      issues.push(`Unexpected target tag "${targetTag}"`)
      continue
    }

    if (targetId.length === 0) {
      issues.push(`Target selection for tag "${targetTag}" must be a ${targetDefinition.targetType} id`)
      continue
    }

    const target = getTarget(targetDefinition.targetType, targetId, turnState)
    if (target === undefined) {
      const targetTypeName = {
        [TargetType.FLEET]: "Fleet",
        [TargetType.PLANET]: "Planet",
        [TargetType.PLAYER]: "Player",
      }[targetDefinition.targetType]
      issues.push(`Target selected for tag "${targetTag}" references unknown ${targetTypeName} id "${targetId}"`)
      continue
    }

    const issue = validateTarget(target, submittedAction.playerId, targetDefinition)
    if (issue !== null) {
      issues.push(issue)
    }
  }

  return issues
}

function getTarget(targetType: TargetType, targetId: string, turnState: ReadonlyDeep<TurnState>): TargetForValidation | undefined {
  switch (targetType) {
    case TargetType.PLAYER:
      return getPlayerTarget(turnState, targetId)
    case TargetType.FLEET:
      return getFleetTarget(turnState, targetId)
    case TargetType.PLANET:
      return getPlanetTarget(turnState, targetId)
  }
}

function getPlayerTarget(turnState: ReadonlyDeep<TurnState>, targetId: string): TargetForValidation | undefined {
  const player = turnState.players[branded<PlayerId>(targetId)]
  if (player === undefined) {
    return undefined
  }

  return { type: TargetType.PLAYER }
}

function getFleetTarget(turnState: ReadonlyDeep<TurnState>, targetId: string): TargetForValidation | undefined {
  const fleet = turnState.fleets[branded<FleetId>(targetId)]
  if (fleet === undefined) {
    return undefined
  }

  return { type: TargetType.FLEET, ownerPlayerId: fleet.ownerPlayerId }
}

function getPlanetTarget(turnState: ReadonlyDeep<TurnState>, targetId: string): TargetForValidation | undefined {
  const planet = turnState.planets[branded<PlanetId>(targetId)]
  if (planet === undefined) {
    return undefined
  }

  return { type: TargetType.PLANET, ownerPlayerId: planet.ownerPlayerId }
}
