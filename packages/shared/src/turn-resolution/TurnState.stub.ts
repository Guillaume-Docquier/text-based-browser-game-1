import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export function createTurnStateStub(overrides?: Partial<TurnState>): TurnState {
  return {
    gameId: typedParse(GameIdSchema, 1),
    turn: 1,
    submittedActions: [],
    players: {},
    planets: {},
    fleets: {},
    winnerPlayerId: undefined,
    ...overrides,
  }
}
