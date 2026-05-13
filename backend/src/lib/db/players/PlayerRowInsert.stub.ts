import type { PlayerRowInsert } from "./players.repository.ts"
import { randomUUID } from "node:crypto"

export function createPlayerRowInsertStub(overrides?: Partial<PlayerRowInsert>): PlayerRowInsert {
  return {
    clerk_id: randomUUID(),
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
