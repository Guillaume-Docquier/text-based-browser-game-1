import { parseEnv } from "#lib/parseEnv.ts"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createApp } from "./createApp.ts"
import { GamesRepository } from "#lib/db/games.repository.ts"
import { PlayersRepository } from "#lib/db/players.repository.ts"
import { AuthService } from "./auth/auth.service.ts"
import pRetry from "p-retry"
import { Logger, createConsoleLogSink, jsonLineFormatter, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"

main().catch((error) => {
  Logger.get().error("Unhandled application error", { error })
  process.exit(1)
})

/**
 * The main entrypoint for the backend
 */
async function main(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production"
  const logger = await Logger.configure({
    sinks: {
      console: createConsoleLogSink({
        formatter: isProd ? jsonLineFormatter : prettyConsoleFormatter,
        redaction: { enabled: isProd },
      }),
    },
  })

  logger.info("Parsing environment")
  const env = parseEnv({ logger })

  logger.info("Connecting to the database")
  const db = drizzle({
    connection: {
      connectionString: env.DATABASE_URL,
      // I probably want ssl?
      // ssl: true,
    },
  })

  logger.info("Performing database migration")
  await migrateDatabase(db, { migrationsFolder: "./drizzle/", logger })

  logger.info("Creating services")
  const playersRepository = new PlayersRepository({ db })
  const gamesRepository = new GamesRepository({ db, logger })

  const authService = new AuthService({ playersRepository })

  logger.info("Creating the API")
  const app = await createApp({ gamesRepository, authService, logger })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(env.PORT, "::", () => {
    logger.info(`API listening on port ${env.PORT}`)
  })
}

/**
 * At the time of writing, the DB was in "serverless" mode, meaning it might be sleeping when we deploy the backend.
 * Retrying should quickly work that out.
 * Long term the DB won't be "serverless", so this issue should go away.
 */
async function migrateDatabase(
  db: NodePgDatabase,
  { migrationsFolder, logger }: { migrationsFolder: string; logger: Logger },
): Promise<void> {
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
