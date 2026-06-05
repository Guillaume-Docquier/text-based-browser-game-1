import type { NewGameModel } from "#lib/db/games/games.repository.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/defaultStarSystemGenerationSettings.ts"

export function createNewGameModelStub(overrides?: Partial<NewGameModel>): NewGameModel {
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
