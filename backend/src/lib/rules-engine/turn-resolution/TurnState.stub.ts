import { branded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export function createTurnStateStub(overrides?: Partial<TurnState>): TurnState {
  return {
    gameId: branded<GameId>(1),
    turn: 0,
    submittedActions: [],
    players: {},
    planets: {},
    fleets: {},
    winnerPlayerId: undefined,
    ...overrides,
  }
}
