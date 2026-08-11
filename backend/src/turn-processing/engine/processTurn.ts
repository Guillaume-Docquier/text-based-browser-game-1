import { Assert } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#turn-processing/engine/actions/ActionSubmission.ts"
import type { EffectsPool } from "#turn-processing/engine/EffectsPool.ts"
import type { Phase } from "#turn-processing/engine/Phase.ts"
import { colonizationPhase } from "#turn-processing/engine/phases/colonizationPhase.ts"
import { combatPhase } from "#turn-processing/engine/phases/combatPhase.ts"
import { governancePhase } from "#turn-processing/engine/phases/governancePhase.ts"
import { incomePhase } from "#turn-processing/engine/phases/incomePhase.ts"
import { movementPhase } from "#turn-processing/engine/phases/movementPhase.ts"
import { payCostsPhase } from "#turn-processing/engine/phases/payCostsPhase.ts"
import type { TurnState } from "#turn-processing/engine/TurnState.ts"

const phases: Phase[] = [payCostsPhase, movementPhase, combatPhase, governancePhase, colonizationPhase, incomePhase]

/**
 * Takes a turn state and applies all its actions on it, then returns the new turn state.
 */
export function processTurn(turnState: Readonly<TurnState>): TurnState {
  const nextTurnState = structuredClone(turnState)
  const effectsPool: EffectsPool = extractEffects(turnState.players.flatMap((player) => player.actions))

  for (const phase of phases) {
    phase(nextTurnState, effectsPool)
  }

  // All effects should be accounted for
  Assert.isTrue(effectsPool.length === 0)

  return nextTurnState
}

function extractEffects(actionSubmissions: ActionSubmission[]): EffectsPool {
  // TODO
  return []
}
