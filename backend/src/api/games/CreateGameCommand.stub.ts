import type { CreateGameCommand } from "#api/games/games.controller.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

export type CreateGameRouterInputStub = Omit<CreateGameCommand, "createdByPlayerId">

export function createGameRouterInputStub(overrides?: Partial<CreateGameRouterInputStub>): CreateGameRouterInputStub {
  return {
    name: "game name",
    nbSeats: 2,
    tickIntervalSeconds: 60,
    starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
    ...overrides,
  }
}
