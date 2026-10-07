import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { RequestHandler } from "express"
import type { Account } from "shared/domain/identity/Account.ts"
import { AliasSchema } from "shared/domain/identity/Alias.ts"
import { v4 } from "uuid"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { AuthProvider } from "#api/auth/AuthProvider.ts"

// If we hooked this into trpc, we'd have better guarantees.
// I just don't really know how to adapt clerk to trpc yet. For now this does the job.
declare global {
  // oxlint-disable-next-line typescript/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      account?: Account | undefined
    }
  }
}

/**
 * Resolves authenticated users to local accounts through an auth provider and accounts repository.
 */
export class AuthService {
  private readonly logger: Logger
  private readonly authProvider: AuthProvider
  private readonly accountsRepository: AccountsRepository

  public constructor({
    logger,
    authProvider,
    accountsRepository,
  }: {
    logger: Logger
    authProvider: AuthProvider
    accountsRepository: AccountsRepository
  }) {
    this.logger = logger.child({ scope: "auth-service" })
    this.authProvider = authProvider
    this.accountsRepository = accountsRepository
  }

  /**
   * Express middleware that parses the authentication token for further usage.
   * The trpc procedures will consume this information.
   */
  public authenticationMiddlewares(): RequestHandler[] {
    return [this.authProvider.parseTokenMiddleware(), this.recordAccountMiddleware()]
  }

  /**
   * Records authenticated accounts to our accounts database if they aren't already.
   *
   * This is an abstraction over Clerk, because we can't full rely on their webhooks to sync data (and we haven't set up one yet anyway).
   */
  private recordAccountMiddleware(): RequestHandler {
    return async (req, res, next) => {
      const authStatus = this.authProvider.parseAuthStatus({ req })
      if (!authStatus.isAuthenticated) {
        next()
        return
      }

      const authId = authStatus.authId
      const getAccountResult = await this.accountsRepository.getAccountByAuthId({ authId })
      if (Result.isFailure(getAccountResult)) {
        this.logger.error("Could not get account from the clerk id", { authId, error: getAccountResult.error })
        next()
        return
      }

      let account = getAccountResult.value
      if (account === undefined) {
        const userResult = await this.authProvider.fetchUser({ authId })
        if (Result.isFailure(userResult)) {
          next()
          return
        }

        const createAccountResult = await this.accountsRepository.createAccount({
          ...userResult.value,
          authId,
          alias: typedParse(AliasSchema, v4()),
          onboarded: false,
        })
        if (Result.isFailure(createAccountResult)) {
          this.logger.error("Could not record new account", { authId, error: createAccountResult.error })
          next()
          return
        }

        account = createAccountResult.value
      }

      req.account = account
      next()
    }
  }
}
