import type { AddressInfo } from "node:net"
import { Logger } from "@guillaume-docquier/tools-ts"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pRetry from "p-retry"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/auth/auth.service.ts"
import type { AuthProvider } from "#api/auth/AuthProvider.ts"
import { ClerkAuthProvider } from "#api/auth/ClerkAuthProvider.ts"
import { TestHeaderAuthProvider } from "#api/auth/TestHeaderAuthProvider.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamesRepository } from "#api/games/games.repository.ts"
import type { PortListeningMessage } from "#api/PortListeningMessage.ts"
import { Clock } from "#lib/Clock.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb, type Database } from "#lib/db/createDb.ts"
import { TurnStateListener } from "#lib/db/TurnStateListener.ts"
import { monitorMemoryUsage } from "#lib/monitorMemoryUsage.ts"
import { BackendEnvSchema, parseEnv } from "#lib/parseEnv.ts"
import { startTurnProcessing } from "#turn-processing/entry.turn-processing.ts"
import { createApi } from "./createApi.ts"

main().catch((error) => {
  Logger.get().error("Unhandled application error", { error })
  process.exit(1)
})

async function main(): Promise<void> {
  const logger = await configureLogger({ scope: "api" })

  logger.info("Parsing environment", { nodeVersion: process.version })
  const env = parseEnv({ schema: BackendEnvSchema })

  logger.info("Connecting to the database")
  const db = createDb({ databaseUrl: env.DATABASE_URL })

  logger.info("Performing database migration")
  // CONSTRAINT: migrationsFolder path is relative to cwd, not to the script path
  await migrateDatabase(db, { migrationsFolder: "./drizzle/", logger })

  logger.info("Creating services")
  const clock = Clock
  const repositories = {
    accountsRepository: new AccountsRepository({ db, logger }),
    gamesRepository: new GamesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger, clock }),
  }

  const authService = new AuthService({
    logger,
    authProvider: createAuthProvider({ provider: env.AUTH_SERVICE, logger }),
    accountsRepository: repositories.accountsRepository,
  })

  logger.info("Creating the API")
  const { api, attachWebSocket, turnStateUseCase } = await createApi({
    logger,
    clock,
    createTransaction: createCreateTransaction(db),
    authService,
    ...repositories,
  })

  const listener = new TurnStateListener({ databaseUrl: env.DATABASE_URL, logger })
  const listenerLifetime = new AbortController()
  const firstListen = Promise.withResolvers<undefined>()
  void listener.listen({
    signal: listenerLifetime.signal,
    onListening: () => {
      turnStateUseCase.refreshAll()
      firstListen.resolve(undefined)
    },
    onChange: (gameId) => {
      turnStateUseCase.refresh(gameId)
    },
  })
  await firstListen.promise

  // CONSTRAINT: Listen to all interfaces (::) for railway's IPv6 internal network
  const server = api.listen(env.PORT, "::", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    const serverAddress = server.address() as AddressInfo

    // CONSTRAINT: If env.PORT is 0, a random port will be attributed, so we log the server port instead of env.PORT
    logger.info(`API listening on port ${serverAddress.port}`)
    // CONSTRAINT: This is currently only used for concurrency tests to know which port the api is using
    process.send?.({ type: "listening", port: serverAddress.port } as const satisfies PortListeningMessage)
  })

  const closeWebSocket = attachWebSocket(server)
  server.once("close", () => {
    listenerLifetime.abort()
    closeWebSocket()
  })

  logger.info("Starting turn processing")
  startTurnProcessing({ logger })

  monitorMemoryUsage({ logger })
}

async function migrateDatabase(db: Database, { migrationsFolder, logger }: { migrationsFolder: string; logger: Logger }): Promise<void> {
  await pRetry(
    async () => {
      await migrate(db, { migrationsFolder })
    },
    {
      retries: 5,
      onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
        logger.info("Failed to migrate the database. It might not be reachable yet, retrying", { error, attemptNumber, retriesLeft })
      },
    },
  )
}

function createAuthProvider({ provider, logger }: { provider: "clerk" | "test-header"; logger: Logger }): AuthProvider {
  switch (provider) {
    case "clerk":
      return new ClerkAuthProvider({ logger })
    case "test-header":
      return new TestHeaderAuthProvider()
  }
}
