import { v4 } from "uuid"
import type { CreateLobbyDto } from "#api/lobbies/lobbies.controller.ts"

export function createCreateLobbyDtoStub(overrides?: Partial<CreateLobbyDto>): CreateLobbyDto {
  return {
    createdByAccountId: v4(),
    configuration: {
      name: "game name",
      nbSeats: 2,
      turnIntervalSeconds: 60,
    },
    ...overrides,
  }
}
