import type { GameInsert } from "#api/games/games.controller.ts"

export function createGameInsertStub(overrides?: Partial<GameInsert>): GameInsert {
  return {
    name: "game name",
    createdByPlayerId: 43,
    nbSeats: 2,
    tickIntervalSeconds: 60,
    ...overrides,
  }
}
