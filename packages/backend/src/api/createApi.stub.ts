import { Logger } from "@guillaume-docquier/tools-ts"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/auth/auth.service.ts"
import { TestHeaderAuthProvider } from "#api/auth/TestHeaderAuthProvider.ts"
import { type Api, createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamesRepository } from "#api/games/games.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService">

export async function createApiStub({ db, clock = Clock }: { db: Database; clock?: Clock }): Promise<AllServices & Api> {
  const logger = Logger.get()
  const accountsRepository = new AccountsRepository({ db, logger })

  const apiServices = {
    logger,
    clock,
    authService: new AuthService({ logger, authProvider: new TestHeaderAuthProvider(), accountsRepository }),
    createTransaction: createCreateTransaction(db),
    accountsRepository,
    gamesRepository: new GamesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger, clock }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(apiServices)

  return {
    ...apiServices,
    ...api,
  }
}
