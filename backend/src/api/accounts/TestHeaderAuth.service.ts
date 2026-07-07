import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler } from "express"
import type { AccountsController } from "#api/accounts/accounts.controller.ts"
import type { AuthService } from "#api/accounts/AuthService.ts"

const AUTH_ID_HEADER = "x-test-authId-id"

export class TestHeaderAuthService implements AuthService {
  private readonly logger: Logger

  public constructor({ logger }: { logger: Logger }) {
    this.logger = logger.child({ scope: "test-header-auth-service" })
  }

  public authenticationMiddlewares({ accountsController }: { accountsController: AccountsController }): RequestHandler[] {
    return [
      async (req, _res, next): Promise<void> => {
        const authId = req.header(AUTH_ID_HEADER)
        if (authId === undefined) {
          next()
          return
        }

        const findAccountResult = await accountsController.getAccountByAuthId({ authId })
        if (Result.isFailure(findAccountResult)) {
          this.logger.error("Could not get account from the test header auth id", { authId, error: findAccountResult.error })
          next()
          return
        }

        req.account = findAccountResult.value
        next()
      },
    ]
  }
}
