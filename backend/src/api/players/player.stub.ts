import type { Player } from "./players.controller.ts"

export function createPlayerStub(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    clerk_id: "clerk_player-1",
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
