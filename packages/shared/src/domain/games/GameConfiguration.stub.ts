import { Time, type UnbrandedProperties, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { GameConfigurationSchema, type GameConfiguration } from "#shared/domain/games/GameConfiguration.ts"

/**
 * Creates game settings with a fresh ruleset ID unless one is supplied.
 */
export function createGameConfigurationStub(overrides: Partial<UnbrandedProperties<GameConfiguration>> = {}): GameConfiguration {
  return typedParse(GameConfigurationSchema, {
    name: "game configuration",
    nbSeats: 5,
    turnIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    rulesetId: v4(),
    ...overrides,
  })
}
