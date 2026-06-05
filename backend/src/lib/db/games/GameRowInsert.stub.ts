import type { NewGameModel } from "#lib/db/games/games.repository.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/star-systems/StarSystemGenerationSettings.stub.ts"

export function createNewGameModelStub(overrides?: Partial<NewGameModel>): NewGameModel {
  return {
    createdByPlayerId: 43,
    settings: {
      name: "game name",
      starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
      nbSeats: 2,
      tickIntervalSeconds: 60,
    },
    ...overrides,
  }
}
