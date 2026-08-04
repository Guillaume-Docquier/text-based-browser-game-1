import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { GameConfigurationDto } from "#api/lobbies/lobbies.controller.ts"

export function createGameConfigurationDtoStub(overrides?: Partial<GameConfigurationDto>): GameConfigurationDto {
  return {
    name: "game configuration",
    nbSeats: 5,
    turnIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    ...overrides,
  }
}
