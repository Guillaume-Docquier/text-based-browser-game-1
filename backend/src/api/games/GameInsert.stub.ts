import type { GameInsert } from "#api/games/games.controller.ts"

export function createGameInsertStub(overrides?: Partial<GameInsert>): GameInsert {
  return {
    createdByPlayerId: 43,
    settings: {
      name: "game name",
      nbSeats: 2,
      tickIntervalSeconds: 60,
    },
    ...overrides,
  }
}
