import { randomUUID } from "crypto"
import { createServer, type Server } from "http"
import type { AddressInfo } from "node:net"
import { Result } from "@guillaume-docquier/tools-ts"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { RequestHandler } from "express"
import { GenericContainer, type StartedTestContainer } from "testcontainers"
import { AccountsRepository, type AccountModel } from "#api/accounts/accounts.repository.ts"
import type { IAuthService } from "#api/accounts/auth.service.ts"
import { createApi, type TrpcRouter } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb, type Database } from "#lib/db/createDb.ts"

const ACCOUNT_ID_HEADER = "x-test-account-id"
const ANY_UNUSED_PORT = 0

export type LoadTestServer = {
  readonly db: Database
  readonly accountsRepository: AccountsRepository
  readonly lobbiesRepository: LobbiesRepository
  readonly gameplayRepository: GameplayRepository
  readonly createClient: (account: AccountModel) => ReturnType<typeof createTRPCClient<TrpcRouter>>
  readonly close: () => Promise<void>
}

const loadTestLogger = configureLogger({ scope: "load-test", nonBlocking: false })

export async function createLoadTestServer(): Promise<LoadTestServer> {
  const logger = await loadTestLogger
  const postgres = await startPostgresContainer()
  const db = createDb({ databaseUrl: getPostgresConnectionUri(postgres) })
  await migrate(db, { migrationsFolder: "./drizzle/" })

  const accountsRepository = new AccountsRepository({ db, logger })
  const lobbiesRepository = new LobbiesRepository({ db, logger })
  const gameplayRepository = new GameplayRepository({ db, logger, clock: Clock })
  const authService = new HeaderAuthService()

  const api = await createApi({
    logger,
    clock: Clock,
    createTransaction: createCreateTransaction(db),
    authService,
    accountsRepository,
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository,
    gameplayRepository,
  })

  const server = createServer(api)
  await listen(server)
  const address = server.address() as AddressInfo

  return {
    db,
    accountsRepository,
    lobbiesRepository,
    gameplayRepository,
    createClient: (account) =>
      createTRPCClient<TrpcRouter>({
        links: [
          httpBatchLink({
            url: `http://localhost:${address.port}/trpc`,
            headers: { [ACCOUNT_ID_HEADER]: account.id },
          }),
        ],
      }),
    close: async () => {
      await close(server)
      await postgres.stop()
    },
  }
}

class HeaderAuthService implements IAuthService {
  public authenticationMiddlewares(): RequestHandler[] {
    return [
      (req, _res, next): void => {
        const accountId = req.header(ACCOUNT_ID_HEADER)
        req.account = accountId === undefined ? undefined : { id: accountId, authId: accountId, email: null, alias: null }
        next()
      },
    ]
  }
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.listen(ANY_UNUSED_PORT, () => {
      resolve()
    })
  })
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }

      reject(error)
    })
  })
}

export async function createAccounts({
  accountsRepository,
  nbAccounts,
}: {
  accountsRepository: AccountsRepository
  nbAccounts: number
}): Promise<AccountModel[]> {
  const accounts: AccountModel[] = []

  for (let accountNumber = 0; accountNumber < nbAccounts; accountNumber++) {
    const accountResult = await accountsRepository.createAccount({
      authId: `load-test-account-${randomUUID()}`,
      email: `load-test-${randomUUID()}@example.com`,
      alias: `Load Test ${accountNumber}`,
    })
    if (Result.isFailure(accountResult)) {
      throw new Error(accountResult.error)
    }

    accounts.push(accountResult.value)
  }

  return accounts
}

export async function ignoreExpectedRequestFailures(requests: Array<Promise<unknown>>): Promise<void> {
  await Promise.allSettled(requests)
}

export async function randomDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 20)))
}

async function startPostgresContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer("postgres:18-alpine")
    .withEnvironment({
      POSTGRES_DB: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_USER: "test",
    })
    .withExposedPorts(5432)
    .start()
}

function getPostgresConnectionUri(postgres: StartedTestContainer): string {
  return `postgres://test:test@${postgres.getHost()}:${postgres.getMappedPort(5432)}/test`
}
