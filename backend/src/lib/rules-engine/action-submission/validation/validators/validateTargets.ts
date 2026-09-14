import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import {
  TargetCondition,
  type TargetRequirement,
  TargetType,
} from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { Planet, TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

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
  targetRequirement: TargetRequirement | undefined,
  targetSlot: string,
  targetId: string,
  playerId: PlayerId,
  turnState: ReadonlyDeep<TurnState>,
): string | null {
  if (targetRequirement === undefined) {
    return `Unexpected target slot "${targetSlot}"`
  }

  if (targetId.length === 0) {
    return `Target slot "${targetSlot}" must be set to a ${targetRequirement.type} id`
  }

  let issue: string | null
  switch (targetRequirement.type) {
    case TargetType.PLAYER:
      issue = validatePlayerTarget(turnState, targetSlot, targetId)
      break
    case TargetType.FLEET:
      issue = validateFleetTarget(turnState, targetSlot, targetId)
      break
    case TargetType.PLANET:
      issue = validatePlanetTarget(turnState, targetSlot, targetId)
      break
  }

  if (issue !== null) {
    return issue
  }

  for (const condition of targetRequirement.conditions) {
    switch (condition) {
      case TargetCondition.OWNED:
        issue = validateOwnedTarget(turnState, targetRequirement.type, targetSlot, targetId, playerId)
        break
    }

    if (issue !== null) {
      return issue
    }
  }

  return null
}

function validatePlayerTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): string | null {
  if (turnState.players[branded<PlayerId>(targetId)] === undefined) {
    return `Target slot "${targetSlot}" references unknown Player id "${targetId}"`
  }

  return null
}

function validateFleetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): string | null {
  if (turnState.fleets[branded<FleetId>(targetId)] === undefined) {
    return `Target slot "${targetSlot}" references unknown Fleet id "${targetId}"`
  }

  return null
}

function validatePlanetTarget(turnState: ReadonlyDeep<TurnState>, targetSlot: string, targetId: string): string | null {
  if (getPlanet(turnState, targetId) === undefined) {
    return `Target slot "${targetSlot}" references unknown Planet id "${targetId}"`
  }

  return null
}

function validateOwnedTarget(
  turnState: ReadonlyDeep<TurnState>,
  targetType: TargetType,
  targetSlot: string,
  targetId: string,
  playerId: PlayerId,
): string | null {
  switch (targetType) {
    case TargetType.PLANET:
      if (getPlanet(turnState, targetId)?.ownerPlayerId !== playerId) {
        return `Target slot "${targetSlot}" references Planet id "${targetId}" that is not owned by Player "${playerId}"`
      }
      return null
    case TargetType.FLEET:
      if (turnState.fleets[branded<FleetId>(targetId)]?.playerId !== playerId) {
        return `Target slot "${targetSlot}" references Fleet id "${targetId}" that is not owned by Player "${playerId}"`
      }
      return null
    case TargetType.PLAYER:
      return `Target slot "${targetSlot}" cannot apply condition "${TargetCondition.OWNED}" to a ${TargetType.PLAYER} target`
  }
}

/**
 * This is O(1)
 */
function getPlanet(turnState: TurnState, targetId: string): Planet | undefined {
  return turnState.planets[branded<PlanetId>(Number(targetId))]
}
