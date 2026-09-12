import { branded, NotImplementedError, Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"
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

    // This keeps only 1 of each target definition
    // Fine as long as it stays simple (no conditions / refinements)
    const allTargetDefinitions = new Map<string, TargetDefinition["type"]>(
      [...actionDefinition.costs, ...actionDefinition.mechanics]
        .flatMap((mechanic) => Object.values(mechanic.targets))
        .map(({ tag, type }) => [tag, type]),
    )

    for (const [targetSlot, targetId] of Object.entries(submittedAction.selectedTargets)) {
      const issue = validateTargetDefinition(allTargetDefinitions.get(targetSlot), targetSlot, targetId, turnState)
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
  targetType: TargetDefinition["type"] | undefined,
  targetSlot: string,
  targetId: string,
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
    case TargetType.PLANET_OWNED:
      throw new NotImplementedError({ trackedBy: "https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/440" })
  }
}

/**
 * This is O(1)
 */
function getPlanet(turnState: TurnState, targetId: string): Planet | undefined {
  return turnState.planets[branded<PlanetId>(Number(targetId))]
}
