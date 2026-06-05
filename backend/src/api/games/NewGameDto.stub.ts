import type { NewGameDto } from "#api/games/games.controller.ts"

export function createNewGameDtoStub(overrides?: Partial<NewGameDto>): NewGameDto {
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
