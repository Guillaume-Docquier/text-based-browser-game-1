import { v4 } from "uuid"
import type { CreateGameDto } from "#api/games/games.controller.ts"

export function createCreateGameDtoStub(overrides?: Partial<CreateGameDto>): CreateGameDto {
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
