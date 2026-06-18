import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { GameConfigurationDto } from "#api/lobbies/lobbies.controller.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

export function createGameConfigurationDtoStub(overrides?: Partial<GameConfigurationDto>): GameConfigurationDto {
  return {
    name: "game configuration",
    nbSeats: 5,
    starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
    tickIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    ...overrides,
  }
}
