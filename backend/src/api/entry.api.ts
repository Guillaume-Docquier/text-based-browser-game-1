import type { AddressInfo } from "node:net"
import { Logger } from "@guillaume-docquier/tools-ts"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pRetry from "p-retry"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/accounts/auth.service.ts"
import { ClerkAuthProvider } from "#api/accounts/ClerkAuthProvider.ts"
import { TestHeaderAuthProvider } from "#api/accounts/TestHeaderAuthProvider.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import type { PortListeningMessage } from "#api/PortListeningMessage.ts"
import { Clock } from "#lib/Clock.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb, type Database } from "#lib/db/createDb.ts"
import { monitorMemoryUsage } from "#lib/monitorMemoryUsage.ts"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"
import { startTurnProcessing } from "#turn-processing/entry.turn-processing.ts"
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

  logger.info("Parsing environment", { nodeVersion: process.version })
  const env = parseEnv({ logger, schema: envSchema })

  logger.info("Connecting to the database")
  const db = createDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Performing database migration")
  // migrationsFolder path is relative to cwd, not to the script path
  await migrateDatabase(db, { migrationsFolder: "./drizzle/", logger })

  logger.info("Creating services")
  const clock = Clock
  const repositories = {
    accountsRepository: new AccountsRepository({ db, logger }),
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger, clock }),
  }

  const authService = createAuthService({ authService: env.AUTH_SERVICE, logger })

  logger.info("Creating the API")
  const app = await createApi({
    logger,
    clock,
    createTransaction: createCreateTransaction(db),
    authService,
    ...repositories,
  })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  const server = app.listen(env.PORT, "::", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    const serverAddress = server.address() as AddressInfo

    // If env.PORT is 0, a random port will be attributed, so we log the server port instead of env.PORT
    logger.info(`API listening on port ${serverAddress.port}`)
    // This is currently only used for concurrency tests to know which port the api is using
    process.send?.({ type: "listening", port: serverAddress.port } as const satisfies PortListeningMessage)
  })

  logger.info("Starting turn processing")
  startTurnProcessing({ logger })

  monitorMemoryUsage({ logger })
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

function createAuthService({ authService, logger }: { authService: "clerk" | "test-header"; logger: Logger }): AuthService {
  switch (authService) {
    case "clerk":
      return new AuthService({ logger, authProvider: new ClerkAuthProvider({ logger }) })
    case "test-header":
      return new AuthService({ logger, authProvider: new TestHeaderAuthProvider() })
  }
}
