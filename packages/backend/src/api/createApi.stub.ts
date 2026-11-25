import { Logger } from "@guillaume-docquier/tools-ts"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { Api } from "#api/Api.ts"
import { AuthService } from "#api/auth/auth.service.ts"
import { TestHeaderAuthProvider } from "#api/auth/TestHeaderAuthProvider.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamesRepository } from "#api/games/games.repository.ts"
import { Clock } from "#lib/Clock.ts"
import { createCreateTransaction, type Database } from "#lib/db/createDb.ts"
import type { ListenForPostgresNotifications } from "#lib/db/createPostgresNotificationListener.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService" | "listenForPostgresNotifications">

export function createApiStub({
  db,
  clock = Clock,
  listenForPostgresNotifications = db.listenForPostgresNotifications,
}: {
  db: Database & { listenForPostgresNotifications: ListenForPostgresNotifications }
  clock?: Clock
  listenForPostgresNotifications?: ListenForPostgresNotifications
}): AllServices & { api: Api } {
  const logger = Logger.get()
  const accountsRepository = new AccountsRepository({ db, logger })

  const gameplayRepository = new GameplayRepository({ db, logger, clock })
  const apiServices = {
    logger,
    clock,
    authService: new AuthService({ logger, authProvider: new TestHeaderAuthProvider(), accountsRepository }),
    createTransaction: createCreateTransaction(db),
    accountsRepository,
    gamesRepository: new GamesRepository({ db, logger }),
    gameplayRepository,
  }

  const api = createApi({ ...apiServices, listenForPostgresNotifications })

  return {
    ...apiServices,
    api,
  }
}
