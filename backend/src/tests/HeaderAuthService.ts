import type { RequestHandler } from "express"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { IAuthService } from "#api/accounts/auth.service.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

export const TEST_ACCOUNT_ID_HEADER = "x-test-account-id"

/**
 * Test-only auth service that maps a request header to a real account from the database.
 *
 * This keeps concurrent API tests independent from shared mutable auth state while still
 * exercising the production express/tRPC stack.
 */
export class HeaderAuthService implements IAuthService {
  private readonly accountsRepository: AccountsRepository

  public constructor({ accountsRepository }: { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
  }

  public authenticationMiddlewares(): RequestHandler[] {
    return [
      async (req, _res, next): Promise<void> => {
        const accountId = req.headers[TEST_ACCOUNT_ID_HEADER]
        if (typeof accountId !== "string") {
          req.account = undefined
          next()
          return
        }

        const account = extractSuccess(await this.accountsRepository.getAccountById({ accountId: accountId }))
        req.account = account
        next()
      },
    ]
  }
}
