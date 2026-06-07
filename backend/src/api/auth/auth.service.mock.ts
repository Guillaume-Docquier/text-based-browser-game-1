import type { RequestHandler } from "express"
import type { AccountDto } from "../accounts/accounts.controller.ts"
import { type IAuthService } from "./auth.service.ts"

export class AuthServiceMock implements IAuthService {
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
