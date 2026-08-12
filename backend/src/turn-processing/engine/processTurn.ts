import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#turn-processing/engine/actions/ActionSubmission.ts"
import { EffectPool } from "#turn-processing/engine/EffectPool.ts"
import { Effect } from "#turn-processing/engine/effects/Effect.ts"
import { colonizationPhase } from "#turn-processing/engine/phases/colonizationPhase.ts"
import { combatPhase } from "#turn-processing/engine/phases/combatPhase.ts"
import { governancePhase } from "#turn-processing/engine/phases/governancePhase.ts"
import { incomePhase } from "#turn-processing/engine/phases/incomePhase.ts"
import { movementPhase } from "#turn-processing/engine/phases/movementPhase.ts"
import { payCostsPhase } from "#turn-processing/engine/phases/payCostsPhase.ts"
import type { PhaseContext } from "#turn-processing/engine/phases/PhaseContext.ts"
import type { PhaseResolver } from "#turn-processing/engine/phases/PhaseResolver.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"
import type { Ruleset } from "#turn-processing/ruleset/ruleset.ts"

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
