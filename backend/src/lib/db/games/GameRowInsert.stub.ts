import type { GameRowInsert } from "#lib/db/games/games.repository.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/defaultStarSystemGenerationSettings.ts"

export function createGameRowInsertStub(overrides?: Partial<GameRowInsert>): GameRowInsert {
  return {
    createdByPlayerId: 43,
    settings: {
      name: "game name",
      starSystemGenerationSettings: createDefaultStarSystemGenerationSettings(),
      nbSeats: 2,
      tickIntervalSeconds: 60,
    },
    ...overrides,
  }
}
