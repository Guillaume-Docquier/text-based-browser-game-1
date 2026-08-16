import { NotImplementedError, Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import { type TargetDefinition, TargetDefinitionSelf } from "#lib/rules-engine/ruleset/mechanics/TargetDefinition.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Validates that the target slots for the action submission are filled and valid.
 */
export function validateTargets(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): Result<ActionSubmissionIssue[], string> {
  const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
  if (actionDefinition === undefined) {
    return Result.Failure(
      `Cannot validate targets for action submission ${actionSubmission.id}, there is no action definition ${actionSubmission.actionDefinitionId}`,
    )
  }

  const issues: ActionSubmissionIssue[] = []

  const missingTargetSlots = Object.keys(actionDefinition.targets).filter(
    (targetSlot) => actionSubmission.targets[targetSlot] === undefined,
  )
  for (const missingTargetSlot of missingTargetSlots) {
    issues.push({
      issue: `missing target slot "${missingTargetSlot}".`,
    })
  }

  // This keeps only 1 of each target definition
  // Fine as long as it stays simple (no conditions / refinements)
  const allTargetDefinitions = new Map<string, TargetDefinition["type"]>(
    [...actionDefinition.costs, ...actionDefinition.mechanics]
      .flatMap((mechanic) => Object.values(mechanic.targets))
      .map(({ tag, type }) => [tag, type]),
  )
  allTargetDefinitions.set(TargetDefinitionSelf.tag, TargetDefinitionSelf.type) // Self is always required, even if no mechanic mentions it

  for (const [targetSlot, targetId] of Object.entries(actionSubmission.targets)) {
    const targetDefinitionIssue = validateTargetDefinition(allTargetDefinitions.get(targetSlot), targetSlot, targetId, turnState)
    if (targetDefinitionIssue !== null) {
      issues.push(targetDefinitionIssue)
    }
  }

  return Result.Success(issues)
}

function validateTargetDefinition(
  targetType: TargetDefinition["type"] | undefined,
  targetSlot: string,
  targetId: string,
  turnState: TurnState,
): ActionSubmissionIssue | null {
  if (targetType === undefined) {
    return {
      issue: `unexpected target slot "${targetSlot}".`,
    }
  }

  if (targetId.length === 0) {
    return {
      issue: `target slot "${targetSlot}" must be set to a ${targetType} id.`,
    }
  }

  switch (targetType) {
    case "PLAYER":
    case "SELF": {
      if (turnState.players[targetId] === undefined) {
        return {
          issue: `target slot "${targetSlot}" references unknown Player id "${targetId}".`,
        }
      }
      return null
    }
    case "FLEET":
      throw new NotImplementedError({ trackedBy: "not tracked" })
    case "PLANET":
      throw new NotImplementedError({ trackedBy: "not tracked" })
  }
}
