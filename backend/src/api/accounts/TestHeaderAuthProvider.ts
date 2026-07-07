import { Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler, Request } from "express"
import type { AuthProvider, AuthStatus, User } from "#api/accounts/AuthProvider.ts"

export const AUTH_ID_HEADER = "x-test-auth-id"

export class TestHeaderAuthProvider implements AuthProvider {
  public parseTokenMiddleware(): RequestHandler {
    return (_req, _res, next): void => {
      next()
    }
  }

  public parseAuthStatus({ req }: { req: Request }): AuthStatus {
    const authId = req.header(AUTH_ID_HEADER)
    if (authId !== undefined) {
      return { isAuthenticated: true, authId }
    }

    return { isAuthenticated: false }
  }

  public async fetchUser(): Promise<Result<User, string>> {
    return Result.Success({ email: null, alias: null })
  }
}
