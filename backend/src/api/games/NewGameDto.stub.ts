import type { NewGameDto } from "#api/games/games.controller.ts"
import { v4 } from "uuid"

export function createNewGameDtoStub(overrides?: Partial<NewGameDto>): NewGameDto {
  return {
    createdByAccountId: v4(),
    settings: {
      name: "game name",
      nbSeats: 2,
      tickIntervalSeconds: 60,
    },
    ...overrides,
  }
}
