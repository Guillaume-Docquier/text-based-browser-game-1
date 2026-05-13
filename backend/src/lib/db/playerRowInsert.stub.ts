import type { PlayerRowInsert } from "#lib/db/players.repository.ts"

export function createPlayerRowInsertStub(overrides?: Partial<PlayerRowInsert>): PlayerRowInsert {
  return {
    clerk_id: "clerk_player-1",
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
