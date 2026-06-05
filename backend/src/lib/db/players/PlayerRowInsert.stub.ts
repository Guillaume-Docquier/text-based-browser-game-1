import type { PlayerRowInsert } from "./players.repository.ts"
import { v4 } from "uuid"

export function createPlayerRowInsertStub(overrides?: Partial<PlayerRowInsert>): PlayerRowInsert {
  return {
    clerk_id: v4(),
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
