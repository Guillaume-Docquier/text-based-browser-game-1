import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"
import { type CreateLobbyConfigurationDto } from "#api/lobbies/lobbies.controller.ts"
import { RulesetId } from "#lib/db/rulesets/RulesetId.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"

export function createLobbyConfigurationDtoStub({
  rulesetId,
  ...overrides
  // z.input to avoid requiring a branded rulesetId to be provided to the stub
}: Partial<z.input<typeof CreateLobbyConfigurationDto>> = {}): CreateLobbyConfigurationDto {
  return {
    name: "game configuration",
    nbSeats: 5,
    turnIntervalSeconds: Time.in(Time.create(24, UnitOfTime.HOURS), UnitOfTime.SECONDS),
    rulesetId: RulesetId.parse(rulesetId ?? TestRuleset.id),
    ...overrides,
  }
}
