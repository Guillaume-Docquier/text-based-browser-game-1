import type { NewPlayerModel } from "./players.repository.ts"
import { v4 } from "uuid"

export function createNewPlayerModelStub(overrides?: Partial<NewPlayerModel>): NewPlayerModel {
  return {
    clerk_id: v4(),
    email: "player@example.com",
    alias: "Player 1",
    ...overrides,
  }
}
