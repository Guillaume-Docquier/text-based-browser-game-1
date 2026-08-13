import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"
import { EffectPool } from "#lib/rules-engine/EffectPool.ts"
import { Effect } from "#lib/rules-engine/effects/Effect.ts"
import { colonizationPhase } from "#lib/rules-engine/phases/colonizationPhase.ts"
import { combatPhase } from "#lib/rules-engine/phases/combatPhase.ts"
import { governancePhase } from "#lib/rules-engine/phases/governancePhase.ts"
import { incomePhase } from "#lib/rules-engine/phases/incomePhase.ts"
import { movementPhase } from "#lib/rules-engine/phases/movementPhase.ts"
import { payCostsPhase } from "#lib/rules-engine/phases/payCostsPhase.ts"
import type { PhaseContext } from "#lib/rules-engine/phases/PhaseContext.ts"
import type { PhaseResolver } from "#lib/rules-engine/phases/PhaseResolver.ts"
import type { TurnState } from "#lib/rules-engine/TurnState.ts"
import type { Ruleset } from "#lib/ruleset/ruleset.ts"

const phaseResolvers: PhaseResolver[] = [payCostsPhase, movementPhase, combatPhase, governancePhase, colonizationPhase, incomePhase]

/**
 * Takes a turn state and applies all its actions on it, then returns the new turn state.
 */
export function processTurn(turnState: Readonly<TurnState>, ruleset: Ruleset): TurnState {
  const actionSubmissions = Object.values(turnState.players).flatMap((player) => player.actionSubmissions)
  const effects = reduceToEffects(actionSubmissions, ruleset)

  const phaseContext: PhaseContext = {
    state: structuredClone(turnState),
    effects: new EffectPool(effects),
    ruleset,
  }

  for (const phaseResolver of phaseResolvers) {
    phaseResolver(phaseContext)
  }

  // All effects should be accounted for
  Assert.isTrue(phaseContext.effects.isEmpty())

  return phaseContext.state
}

function reduceToEffects(actionSubmissions: ActionSubmission[], ruleset: Ruleset): Effect[] {
  return actionSubmissions.flatMap((actionSubmission) => {
    const actionDefinition = ruleset.actionDefinitions[actionSubmission.actionDefinitionId]
    Assert.isDefined(actionDefinition)

    return [
      ...actionDefinition.costs.map((costMechanic) => Effect.fromMechanic({ mechanic: costMechanic })),
      ...actionDefinition.mechanics.map((mechanic) => Effect.fromMechanic({ mechanic })),
    ]
  })
}
