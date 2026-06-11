import { v4 } from "uuid"
import type { CreateGameDto } from "#api/game-lobbies/gameLobbies.controller.ts"

export function createCreateGameDtoStub(overrides?: Partial<CreateGameDto>): CreateGameDto {
  return {
    createdByAccountId: v4(),
    configuration: {
      name: "game name",
      nbSeats: 2,
      tickIntervalSeconds: 60,
    },
    ...overrides,
  }
}
