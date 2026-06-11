import { v4 } from "uuid"
import type { CreateLobbyDto } from "#api/lobbies/lobbies.controller.ts"

export function createCreateGameDtoStub(overrides?: Partial<CreateLobbyDto>): CreateLobbyDto {
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
