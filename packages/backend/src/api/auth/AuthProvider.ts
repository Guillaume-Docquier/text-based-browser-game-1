import type { Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler, Request } from "express"
import type { FetchUserError } from "#api/auth/fetchUser.error.ts"

export type AuthStatus =
  | {
      isAuthenticated: false
    }
  | {
      isAuthenticated: true
      authId: string
    }

export type User = {
  email: string | null | undefined
}

export interface AuthProvider {
  parseTokenMiddleware: () => RequestHandler
  parseAuthStatus: (args: { req: Request }) => AuthStatus
  fetchUser: (args: { authId: string }) => Promise<Result<User, FetchUserError>>
}
