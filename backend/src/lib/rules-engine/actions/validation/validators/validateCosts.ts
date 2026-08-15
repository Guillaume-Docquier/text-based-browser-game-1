import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/actions/validation/ActionSubmissionValidationIssue.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/Ruleset.ts"

export function validateCosts(
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
): ActionSubmissionValidationIssue[] {
  const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
  Assert.isDefined(actionDefinition)

  const targets = actionSubmission.targets

  const player = turnState.players[targets.self]
  Assert.isDefined(player)

  const costEffects = actionDefinition.costs.map((mechanic) => Effect.fromMechanic({ mechanic, targets }))

  // We'll need something better that can reuse effect resolvers if we start having costs beyond resources
  const resourcesAvailable = structuredClone(player.resources)
  for (const costEffect of costEffects) {
    resourcesAvailable[costEffect.mechanic.resourceType] -= costEffect.mechanic.quantity
  }

  // We'll need something better that can format issues per cost mechanic if we start having costs beyond resources
  return Object.entries(resourcesAvailable)
    .filter(([_, resourceCount]) => resourceCount < 0)
    .map(([resourceType, resourceCount]) => ({
      issue: `Missing ${Math.abs(resourceCount)} ${resourceType} to play ${actionDefinition.name}`,
    }))
}
