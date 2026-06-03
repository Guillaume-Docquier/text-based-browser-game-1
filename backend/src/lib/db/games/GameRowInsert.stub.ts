import type { GameRowInsert } from "#lib/db/games/games.repository.ts"
import { randomUUID } from "node:crypto"

export function createGameRowInsertStub(overrides?: Partial<GameRowInsert>): GameRowInsert {
  return {
    name: "game name",
    createdByPlayerId: 43,
    starSystemGenerationSettingsId: randomUUID(),
    nbSeats: 2,
    tickIntervalSeconds: 60,
    ...overrides,
  }
}
