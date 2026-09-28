import { Logger } from "@guillaume-docquier/tools-ts"
import type { Express } from "express"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/accounts/auth.service.ts"
import { TestHeaderAuthProvider } from "#api/accounts/TestHeaderAuthProvider.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService">

/**
 * Creates a real api with test dependencies.
 * The db will be mocked with an empty in-memory db.
 * The auth service will use a mocked service with no authenticated user.
 */
export async function createApiStub({ db, clock = Clock }: { db?: Database; clock?: Clock } = {}): Promise<AllServices & { api: Express }> {
  const logger = Logger.get()
  db ??= await createDbMock()

  const apiServices = {
    logger,
    clock,
    authService: new AuthService({ logger, authProvider: new TestHeaderAuthProvider() }),
    createTransaction: createCreateTransaction(db),
    accountsRepository: new AccountsRepository({ db, logger }),
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger, clock }),
    rulesetsRepository: new RulesetsRepository({ db, logger }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(apiServices)

  return {
    ...apiServices,
    api,
  }
}
