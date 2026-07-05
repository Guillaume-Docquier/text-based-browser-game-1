import type { RequestHandler } from "express"
import type { IAuthService } from "#api/accounts/auth.service.ts"

const ACCOUNT_ID_HEADER = "x-test-account-id"

export class TestHeaderAuthService implements IAuthService {
  public authenticationMiddlewares(): RequestHandler[] {
    return [
      (req, _res, next): void => {
        const accountId = req.header(ACCOUNT_ID_HEADER)
        req.account = accountId === undefined ? undefined : { id: accountId, authId: accountId, email: null, alias: null }
        next()
      },
    ]
  }
}
