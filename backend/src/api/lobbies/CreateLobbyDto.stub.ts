import { v4 } from "uuid"
import type { CreateLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

export function createCreateLobbyDtoStub(overrides?: Partial<CreateLobbyDto>): CreateLobbyDto {
  return {
    createdByAccountId: v4(),
    configuration: {
      name: "game name",
      nbSeats: 2,
      tickIntervalSeconds: 60,
      starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
    },
    ...overrides,
  }
}
