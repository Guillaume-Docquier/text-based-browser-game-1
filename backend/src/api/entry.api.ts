import { Logger } from "@guillaume-docquier/tools-ts"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pRetry from "p-retry"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/accounts/auth.service.ts"
import { GameListingsRepository } from "#api/game-listings/gameListings.repository.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import type { Database } from "#lib/db/createDb.ts"
import { createDb } from "#lib/db/createDb.ts"
import { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"
import { startTickProcessing } from "#tick-processing/entry.tick-processing.ts"
import { createApi } from "./createApi.ts"

main().catch((error) => {
  Logger.get().error("Unhandled application error", { error })
  process.exit(1)
})

/**
 * The main entrypoint for the backend
 */
async function main(): Promise<void> {
  const logger = await configureLogger({ scope: "api" })

  logger.info("Parsing environment")
  const env = parseEnv({ logger, schema: envSchema })

  logger.info("Connecting to the database")
  const db = createDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Performing database migration")
  // migrationsFolder path is relative to cwd, not to the script path
  await migrateDatabase(db, { migrationsFolder: "./drizzle/", logger })

  logger.info("Creating services")
  const repositories = {
    accountsRepository: new AccountsRepository({ db, logger }),
    gamesRepository: new GamesRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    gamePlayerActionsRepository: new GamePlayerActionsRepository({ db, logger }),
    starSystemsRepository: new StarSystemsRepository({ db, logger }),
    gameListingsRepository: new GameListingsRepository({ db, logger }),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger }),
  }

  const authService = new AuthService({ logger })

  logger.info("Creating the API")
  const app = await createApi({
    logger,
    createTransaction: db.transaction.bind(db),
    authService,
    ...repositories,
  })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(env.PORT, "::", () => {
    logger.info(`API listening on port ${env.PORT}`)
  })

  logger.info("Starting tick processing")
  startTickProcessing({ logger })
}

/**
 * At the time of writing, the DB was in "serverless" mode, meaning it might be sleeping when we deploy the backend.
 * Retrying should quickly work that out.
 * Long term the DB won't be "serverless", so this issue should go away.
 */
async function migrateDatabase(db: Database, { migrationsFolder, logger }: { migrationsFolder: string; logger: Logger }): Promise<void> {
  await pRetry(
    async () => {
      await migrate(db, { migrationsFolder })
    },
    {
      retries: 5,
      onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
        logger.info("Failed to migrate the database. It might not be awake, retrying", { error, attemptNumber, retriesLeft })
      },
    },
  )
}
