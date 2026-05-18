import type { NewGameDto } from "#api/games/games.controller.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

export function createNewGameDtoStub(overrides?: Partial<NewGameDto>): NewGameDto {
  return {
    name: "game name",
    nbSeats: 2,
    tickIntervalSeconds: 60,
    starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
    ...overrides,
  }
}
