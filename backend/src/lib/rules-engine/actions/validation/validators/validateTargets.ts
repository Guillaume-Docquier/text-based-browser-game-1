import { NotImplementedError } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import type { TargetDefinition } from "#lib/rules-engine/mechanics/TargetDefinition.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

/**
 * Validates that the target slots for the action submission are filled and valid.
 */
export function validateTargets(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionValidationIssue[] {
  const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
  if (actionDefinition === undefined) {
    return [] // Failed prior validation but we always run all validators
  }

  const issues: ActionSubmissionValidationIssue[] = []

  const missingTargetSlots = Object.keys(actionDefinition.targets).filter(
    (targetSlot) => actionSubmission.targets[targetSlot] === undefined,
  )
  for (const missingTargetSlot of missingTargetSlots) {
    issues.push({
      issue: `Submitted action ${actionSubmission.id} is missing target slot ${missingTargetSlot} from its Action Definition ${actionDefinition.name}`,
    })
  }

  // This keeps only 1 of each target definition
  // Fine as long as it stays simple (no conditions / refinements)
  const allTargetDefinitions = new Map<string, TargetDefinition["type"]>(
    [...actionDefinition.costs, ...actionDefinition.mechanics]
      .flatMap((mechanic) => Object.values(mechanic.targets))
      .map(({ tag, type }) => [tag, type]),
  )
  for (const [targetSlot, targetId] of Object.entries(actionSubmission.targets)) {
    const targetDefinitionIssue = validateTargetDefinition(
      actionSubmission,
      allTargetDefinitions.get(targetSlot),
      targetSlot,
      targetId,
      turnState,
    )
    if (targetDefinitionIssue !== null) {
      issues.push(targetDefinitionIssue)
    }
  }

  if (turnState.players[actionSubmission.targets.self] === undefined) {
    issues.push({
      issue: `Submitted action ${actionSubmission.id} self target ${actionSubmission.targets.self} is not a player.`,
    })
  }

  return issues
}

function validateTargetDefinition(
  actionSubmission: ActionSubmission,
  targetType: TargetDefinition["type"] | undefined,
  targetSlot: string,
  targetId: string,
  turnState: TurnState,
): ActionSubmissionValidationIssue | null {
  if (targetType === undefined) {
    return {
      issue: `Submitted action ${actionSubmission.id} ${targetSlot} target slot is unexpected.`,
    }
  }

  if (targetId === undefined) {
    return {
      issue: `Submitted action ${actionSubmission.id} ${targetSlot} target slot must be set.`,
    }
  }

  switch (targetType) {
    case "PLAYER":
    case "SELF": {
      if (turnState.players[targetId] === undefined) {
        return {
          issue: `Submitted action ${actionSubmission.id} ${targetSlot} target ${targetId} is not a player.`,
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
