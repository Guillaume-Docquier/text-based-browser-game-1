import { Logger } from "@guillaume-docquier/tools-ts"
import type { Express } from "express"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthService } from "#api/auth/auth.service.ts"
import { TestHeaderAuthProvider } from "#api/auth/TestHeaderAuthProvider.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamesRepository } from "#api/games/games.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"
import type { NotificationListener } from "#lib/db/PostgresNotificationListener.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService">

export async function createApiStub({
  db,
  clock = Clock,
  notificationListener = db.notificationListener,
}: {
  db: Database & { notificationListener: NotificationListener }
  clock?: Clock
  notificationListener?: NotificationListener
}): Promise<AllServices & { api: Express }> {
  const logger = Logger.get()
  const accountsRepository = new AccountsRepository({ db, logger })

  const apiServices = {
    logger,
    clock,
    notificationListener,
    authService: new AuthService({ logger, authProvider: new TestHeaderAuthProvider(), accountsRepository }),
    createTransaction: createCreateTransaction(db),
    accountsRepository,
    gamesRepository: new GamesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger, clock }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(apiServices)

  return {
    ...apiServices,
    api,
  }
}
