import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler } from "express"
import type { AccountDto, AccountsController } from "#api/accounts/accounts.controller.ts"
import type { AuthAdapter } from "#api/accounts/AuthAdapter.ts"

// If we hooked this into trpc, we'd have better guarantees.
// I just don't really know how to adapt clerk to trpc yet. For now this does the job.
declare global {
  // oxlint-disable-next-line typescript/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      account?: AccountDto | undefined
    }
  }
}

/**
 * Encapsulates Clerk.
 * This should be the only place we use Clerk directly.
 *
 * It'll make tests easier, and if Clerk turns out to be a problem, we can change it.
 */
export class AuthService {
  private readonly logger: Logger
  private readonly authAdapter: AuthAdapter

  public constructor({ logger, authAdapter }: { logger: Logger; authAdapter: AuthAdapter }) {
    this.logger = logger.child({ scope: "auth-service" })
    this.authAdapter = authAdapter
  }

  /**
   * Express middleware that parses the authentication token for further usage.
   * The trpc procedures will consume this information.
   */
  public authenticationMiddlewares({ accountsController }: { accountsController: AccountsController }): RequestHandler[] {
    return [this.authAdapter.parseTokenMiddleware(), this.recordAccountMiddleware({ accountsController })]
  }

  /**
   * Records authenticated accounts to our accounts database if they aren't already.
   *
   * This is an abstraction over Clerk, because we can't full rely on their webhooks to sync data (and we haven't set up one yet anyway).
   */
  private recordAccountMiddleware({ accountsController }: { accountsController: AccountsController }): RequestHandler {
    return async (req, res, next) => {
      const authStatus = this.authAdapter.parseAuthStatus({ req })
      if (!authStatus.isAuthenticated) {
        next()
        return
      }

      const authId = authStatus.authId
      const findAccountResult = await accountsController.getAccountByAuthId({ authId })
      if (Result.isFailure(findAccountResult)) {
        this.logger.error("Could not get account from the clerk id", { authId, error: findAccountResult.error })
        next()
        return
      }

      let account = findAccountResult.value
      if (account === undefined) {
        const clerkUser = await this.authAdapter.fetchUser({ authId })
        if (Result.isFailure(clerkUser)) {
          next()
          return
        }

        const createAccountResult = await accountsController.createAccount({ ...clerkUser.value, authId })
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
