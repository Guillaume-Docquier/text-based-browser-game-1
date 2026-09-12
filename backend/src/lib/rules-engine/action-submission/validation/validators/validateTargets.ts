import { branded, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
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
  targetType: TargetType | undefined,
  targetSlot: string,
  targetId: string,
  playerId: PlayerId,
  turnState: ReadonlyDeep<TurnState>,
): string | null {
  if (targetType === undefined) {
    return `Unexpected target slot "${targetSlot}"`
  }

  if (targetId.length === 0) {
    return `Target slot "${targetSlot}" must be set to a ${targetType} id`
  }

  switch (targetType) {
    case TargetType.PLAYER:
      if (turnState.players[branded<PlayerId>(targetId)] === undefined) {
        return `Target slot "${targetSlot}" references unknown Player id "${targetId}"`
      }
      return null
    case TargetType.FLEET:
      if (turnState.fleets[branded<FleetId>(targetId)] === undefined) {
        return `Target slot "${targetSlot}" references unknown Fleet id "${targetId}"`
      }
      return null
    case TargetType.PLANET:
      if (getPlanet(turnState, targetId) === undefined) {
        return `Target slot "${targetSlot}" references unknown Planet id "${targetId}"`
      }
      return null
    case TargetType.PLANET_OWNED: {
      const planet = getPlanet(turnState, targetId)
      if (planet === undefined) {
        return `Target slot "${targetSlot}" references unknown Planet id "${targetId}"`
      }
      if (planet.ownerPlayerId !== playerId) {
        return `Target slot "${targetSlot}" references Planet id "${targetId}" that is not owned by Player "${playerId}"`
      }
      return null
    }
  }
}

/**
 * This is O(1)
 */
function getPlanet(turnState: TurnState, targetId: string): Planet | undefined {
  return turnState.planets[branded<PlanetId>(Number(targetId))]
}
