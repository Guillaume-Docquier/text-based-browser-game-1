import type { NewGameModel } from "#lib/db/games/games.repository.ts"
import { v4 } from "uuid"

export function createNewGameModelStub(overrides?: Partial<NewGameModel>): NewGameModel {
  return {
    createdByAccountId: v4(),
    ...overrides,
  }
}
