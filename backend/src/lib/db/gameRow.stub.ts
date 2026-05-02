import type { GameRow } from "#lib/db/games.repository.ts"

export function createGameRowStub(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: 1,
    name: "Game 1",
    createdByPlayerId: 1,
    winnerPlayerId: null,
    nbSeats: 4,
    tickIntervalSeconds: 60,
    createdAt: new Date(),
    startedAt: null,
    endedAt: null,
    ...overrides,
  }
}
