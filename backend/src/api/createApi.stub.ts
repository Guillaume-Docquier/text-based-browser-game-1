import { Logger } from "@guillaume-docquier/tools-ts"
import type { Express } from "express"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthServiceMock } from "#api/accounts/auth.service.mock.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"

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
    gamePlayerActionsRepository: new GamePlayerActionsRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    accountsRepository: new AccountsRepository({ db, logger }),
    starSystemsRepository: new StarSystemsRepository({ db, logger }),
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(services)

  return {
    ...services,
    api,
  }
}
