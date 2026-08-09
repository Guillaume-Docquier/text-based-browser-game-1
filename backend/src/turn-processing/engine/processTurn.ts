import type { TurnState } from "#turn-processing/engine/TurnState.ts"

/**
 * Takes a turn state and applies all its actions on it, then returns the new turn state.
 */
export function processTurn(turnState: Readonly<TurnState>): TurnState {
  return turnState
}
