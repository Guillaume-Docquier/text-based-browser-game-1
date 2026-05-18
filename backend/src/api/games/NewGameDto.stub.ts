import type { NewGameDto } from "#api/games/games.controller.ts"
import { createStarSystemGenerationSettingsDtoStub } from "#api/games/StarSystemGenerationSettingsDto.stub.ts"

export function createNewGameDtoStub(overrides?: Partial<NewGameDto>): NewGameDto {
  return {
    name: "game name",
    nbSeats: 2,
    tickIntervalSeconds: 60,
    starSystemGenerationSettings: createStarSystemGenerationSettingsDtoStub(),
    ...overrides,
  }
}
