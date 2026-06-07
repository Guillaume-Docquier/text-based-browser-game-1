import type { Express } from "express"
import { createApi } from "#api/createApi.ts"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { Logger } from "@guillaume-docquier/tools-ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { AccountsRepository } from "../lib/db/accounts/accounts.repository.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { GameSettingsRepository } from "#lib/db/games/gameSettings.repository.ts"
import { GamePlayersRepository } from "#lib/db/games/gamePlayers.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService"> & { authService: AuthServiceMock }

/**
 * Creates a real api with test dependencies.
 * The db will be mocked with an empty in-memory db.
 * The auth service will use a mocked service with no authenticated user.
 */
export async function createApiStub(): Promise<AllServices & { api: Express }> {
  const logger = Logger.get()
  const db = await createDbMock()

  const services = {
    logger,
    authService: new AuthServiceMock(),
    createTransaction: db.transaction.bind(db),
    gamesRepository: new GamesRepository({ db, logger }),
    gameSettingsRepository: new GameSettingsRepository({ db, logger }),
    gamePlayersRepository: new GamePlayersRepository({ db, logger }),
    gamePlayerActionsRepository: new GamePlayerActionsRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    accountsRepository: new AccountsRepository({ db, logger }),
    starSystemsRepository: new StarSystemsRepository({ db, logger }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(services)

  return {
    ...services,
    api,
  }
}
