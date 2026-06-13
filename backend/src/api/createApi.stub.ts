import { Logger } from "@guillaume-docquier/tools-ts"
import type { Express } from "express"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AuthServiceMock } from "#api/accounts/auth.service.mock.ts"
import { createApi } from "#api/createApi.ts"
import { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { ListingsRepository } from "#api/listings/listings.repository.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"

type AllServices = Omit<Parameters<typeof createApi>[0], "authService"> & { authService: AuthServiceMock }

/**
 * Creates a real api with test dependencies.
 * The db will be mocked with an empty in-memory db.
 * The auth service will use a mocked service with no authenticated user.
 */
export async function createApiStub({ db }: { db?: Database } = {}): Promise<AllServices & { api: Express }> {
  const logger = Logger.get()
  db ??= await createDbMock()

  const apiServices = {
    logger,
    authService: new AuthServiceMock(),
    createTransaction: db.transaction.bind(db),
    accountsRepository: new AccountsRepository({ db, logger }),
    starSystemsRepository: new StarSystemsRepository({ db, logger }),
    listingsRepository: new ListingsRepository({ db, logger }),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
    gameplayRepository: new GameplayRepository({ db, logger }),
  } as const satisfies Parameters<typeof createApi>[0]

  const api = await createApi(apiServices)

  return {
    ...apiServices,
    api,
  }
}
