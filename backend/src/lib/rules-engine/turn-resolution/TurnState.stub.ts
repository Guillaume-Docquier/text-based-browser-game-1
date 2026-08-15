import { createRng } from "@guillaume-docquier/tools-ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export function createTurnStateStub(overrides: Partial<TurnState> = {}): TurnState {
  return {
    rng: createRng(() => 0.5),
    players: {},
    winnerPlayerId: undefined,
    ...overrides,
  }
}
