import type { Express } from "express"
import { createApi } from "#api/createApi.ts"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { IAuthService } from "#api/auth/auth.service.ts"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { Logger } from "@guillaume-docquier/tools-ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { PlayersRepository } from "#lib/db/players/players.repository.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"

/**
 * Creates a real api with test dependencies.
 * The db will be mocked with an empty in-memory db.
 * The auth service will use a mocked service with no authenticated user.
 */
export async function createApiStub({
  db,
  logger = Logger.get(),
  authService = new AuthServiceMock(),
}: {
  db?: NodePgDatabase
  logger?: Logger
  authService?: IAuthService
} = {}): Promise<Express> {
  db ??= await createDbMock()

  return await createApi({
    authService,
    logger,
    gamesRepository: new GamesRepository({ db, logger }),
    gamePlayerActionsRepository: new GamePlayerActionsRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    playersRepository: new PlayersRepository({ db, logger }),
    starSystemsRepository: new StarSystemsRepository({ db, logger }),
  })
}
