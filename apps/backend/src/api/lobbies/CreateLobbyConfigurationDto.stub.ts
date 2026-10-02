import { branded, Time, type UnbrandedProperties, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { TestRuleset } from "shared/test-ruleset/TestRuleset.ts"
import type { CreateLobbyConfigurationDto } from "#api/lobbies/lobbies.controller.ts"

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
