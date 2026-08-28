import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export function createTurnStateStub(overrides?: Partial<TurnState>): TurnState {
  return {
    submittedActions: [],
    players: {},
    winnerPlayerId: undefined,
    ...overrides,
  }
}
