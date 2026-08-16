import { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

/**
 * Validates that all the action submission costs can be paid.
 */
export function validateCosts(
  actionSubmissions: ActionSubmission[],
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): Result<ActionSubmissionIssue[], string> {
  const turnStateCopy = structuredClone(turnState)
  const issues: ActionSubmissionIssue[] = []

  for (const actionSubmission of actionSubmissions) {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    if (actionDefinition === undefined) {
      return Result.Failure(
        `Cannot validate costs for action submission ${actionSubmission.id}, there is no action definition ${actionSubmission.actionDefinitionId}`,
      )
    }

    const targets = actionSubmission.targets

    const player = turnStateCopy.players[targets.self]
    if (player === undefined) {
      return Result.Failure(
        `Cannot validate costs for action submission ${actionSubmission.id}, there is no player with id ${targets.self}`,
      )
    }

    for (const resource in player.resources) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- for in expands narrow types to string
      const resourceNarrow = resource as keyof typeof player.resources

      // Reset to 0 if negative, so that the sum of the issues represents the total resources missing
      // Otherwise each action that's missing resources will declare the sum of missing resources
      player.resources[resourceNarrow] = Math.max(0, player.resources[resourceNarrow])
    }

    // We'll need something better that can reuse effect resolvers if we start having costs beyond resources
    for (const cost of actionDefinition.costs) {
      player.resources[cost.resourceType] -= cost.quantity
    }

    // We'll need something better that can format issues per cost mechanic if we start having costs beyond resources
    issues.push(
      ...Object.entries(player.resources)
        .filter(([_, resourceCount]) => resourceCount < 0)
        .map(([resourceType, resourceCount]) =>
          ActionSubmissionIssue.create({
            issue: `Missing ${Math.abs(resourceCount)} ${resourceType}`,
            actionSubmission,
            actionDefinitionName: actionDefinition.name,
          }),
        ),
    )
  }

  return Result.Success(issues)
}
