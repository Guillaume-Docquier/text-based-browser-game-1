import { Logger } from "@guillaume-docquier/tools-ts"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { createCreateTransaction, createDb, type Database } from "#lib/db/createDb.ts"
import { HeaderAuthService, TEST_ACCOUNT_ID_HEADER } from "#tests/HeaderAuthService.ts"
import { PostgresTestContainer } from "#tests/load/PostgresTestContainer.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

export type LoadTestApi = Awaited<ReturnType<typeof createLoadTestApi>>

export async function createLoadTestApi(): Promise<{
  db: Database
  accountsRepository: AccountsRepository
  lobbiesRepository: LobbiesRepository
  trpcClientForAccount: (accountId: string) => TrpcClient
  [Symbol.asyncDispose]: () => Promise<void>
}> {
  const postgresContainer = new PostgresTestContainer()
  const databaseUrl = await postgresContainer.start()
  const logger = Logger.get()
  const db = createDb({ databaseUrl })

  await migrate(db, { migrationsFolder: "./drizzle/" })

  const accountsRepository = new AccountsRepository({ db, logger })
  const lobbiesRepository = new LobbiesRepository({ db, logger })
  const api = await createApi({
    logger,
    clock: Clock,
    authService: new HeaderAuthService({ accountsRepository }),
    createTransaction: createCreateTransaction(db),
    accountsRepository,
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository,
    gameplayRepository: new GameplayRepository({ db, logger, clock: Clock }),
  })

  return {
    db,
    accountsRepository,
    lobbiesRepository,
    trpcClientForAccount: (accountId): TrpcClient =>
      new TrpcClient({ api, headers: (): Record<string, string> => ({ [TEST_ACCOUNT_ID_HEADER]: accountId }) }),
    [Symbol.asyncDispose]: async () => {
      await postgresContainer.stop()
    },
  }
}
