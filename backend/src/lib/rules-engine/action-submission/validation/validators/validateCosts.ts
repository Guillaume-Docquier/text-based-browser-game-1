import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Validates that all the action submission costs can be paid.
 */
export function validateCosts(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): Result<ActionSubmissionIssue[], string> {
  const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
  if (actionDefinition === undefined) {
    return Result.Failure(
      `Cannot validate costs for action submission ${actionSubmission.id}, there is no action definition ${actionSubmission.actionDefinitionId}`,
    )
  }

  const targets = actionSubmission.targets

  const player = turnState.players[targets.self]
  if (player === undefined) {
    return Result.Failure(`Cannot validate costs for action submission ${actionSubmission.id}, there is no player with id ${targets.self}`)
  }

  const costEffects = actionDefinition.costs.map((mechanic) => Effect.fromMechanic({ mechanic, targets }))

  // We'll need something better that can reuse effect resolvers if we start having costs beyond resources
  const resourcesAvailable = structuredClone(player.resources)
  for (const costEffect of costEffects) {
    resourcesAvailable[costEffect.mechanic.resourceType] -= costEffect.mechanic.quantity
  }

  // We'll need something better that can format issues per cost mechanic if we start having costs beyond resources
  return Result.Success(
    Object.entries(resourcesAvailable)
      .filter(([_, resourceCount]) => resourceCount < 0)
      .map(([resourceType, resourceCount]) => ({
        issue: `missing ${Math.abs(resourceCount)} ${resourceType}.`,
      })),
  )
}
