import type { RequestHandler } from "express"
import type { AccountDto } from "#api/accounts/accounts.controller.ts"
import type { AuthService } from "#api/accounts/AuthService.ts"

/**
 * A test auth service where you can set the auth for the next request(s) by setting the account directly
 */
export class ControlledAuthService implements AuthService {
  public account: AccountDto | undefined

  public constructor({ account }: { account?: AccountDto } = {}) {
    this.account = account
  }

  public authenticationMiddlewares(): RequestHandler[] {
    return [
      (req, _res, next): void => {
        req.account = this.account
        next()
      },
    ]
  }
}
