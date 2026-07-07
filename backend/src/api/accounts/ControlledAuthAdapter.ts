import { Assert, Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler } from "express"
import type { AccountDto } from "#api/accounts/accounts.controller.ts"
import type { AuthAdapter, AuthStatus, User } from "#api/accounts/AuthAdapter.ts"

/**
 * A test auth service where you can set the auth for the next request(s) by setting the account directly
 */
export class ControlledAuthAdapter implements AuthAdapter {
  public account: AccountDto | undefined

  public constructor({ account }: { account?: AccountDto } = {}) {
    this.account = account
  }
  public parseTokenMiddleware(): RequestHandler {
    return (_req, _res, next): void => {
      next()
    }
  }

  public parseAuthStatus(): AuthStatus {
    if (this.account !== undefined) {
      return { isAuthenticated: true, authId: this.account.authId }
    }

    return { isAuthenticated: false }
  }

  public async fetchUser(): Promise<Result<User, string>> {
    Assert.isDefined(this.account)
    return Result.Success(this.account)
  }
}
