import type { GameRowInsert } from "#lib/db/games/games.repository.ts"

export function createGameRowInsertStub(overrides?: Partial<GameRowInsert>): GameRowInsert {
  return {
    name: "game name",
    createdByPlayerId: 43,
    nbSeats: 2,
    tickIntervalSeconds: 60,
    ...overrides,
  }
}
