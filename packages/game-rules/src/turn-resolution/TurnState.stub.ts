import { branded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "game-rules/models/GameId.ts"
import type { TurnState } from "game-rules/turn-resolution/TurnState.ts"

export function createTurnStateStub(overrides?: Partial<TurnState>): TurnState {
  return {
    gameId: branded<GameId>(1),
    turn: 1,
    submittedActions: [],
    players: {},
    planets: {},
    fleets: {},
    winnerPlayerId: undefined,
    ...overrides,
  }
}
