import type { RequestHandler } from "express"
import type { AccountsController } from "#api/accounts/accounts.controller.ts"

export interface AuthService {
  authenticationMiddlewares: ({ accountsController }: { accountsController: AccountsController }) => RequestHandler[]
}
