import { Time, type UnbrandedProperties, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { GameConfigurationSchema, type GameConfiguration } from "#shared/domain/games/GameConfiguration.ts"
import { TestRuleset } from "#shared/testing/test-ruleset/TestRuleset.ts"

/**
 * Creates game settings with a fresh ruleset ID unless one is supplied.
 */
export function createGameConfigurationStub({
  rulesetId = TestRuleset.id,
  ...overrides
}: Partial<UnbrandedProperties<GameConfiguration>> = {}): GameConfiguration {
  return typedParse(GameConfigurationSchema, {
    name: "game configuration",
    nbSeats: 5,
    turnIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    rulesetId,
    ...overrides,
  })
}
