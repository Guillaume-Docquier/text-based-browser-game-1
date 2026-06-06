import type { NewGameModel } from "#lib/db/games/games.repository.ts"

export function createNewGameModelStub(overrides?: Partial<NewGameModel>): NewGameModel {
  return {
    createdByPlayerId: 43,
    ...overrides,
  }
}
