import { branded, Time, type UnbrandedProperties, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { CreateLobbyConfigurationDto } from "#api/lobbies/lobbies.controller.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"

export function createLobbyConfigurationDtoStub({
  rulesetId = TestRuleset.id,
  ...overrides
}: Partial<UnbrandedProperties<CreateLobbyConfigurationDto>> = {}): CreateLobbyConfigurationDto {
  return {
    name: "game configuration",
    nbSeats: 5,
    turnIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    rulesetId: branded(rulesetId),
    ...overrides,
  }
}
