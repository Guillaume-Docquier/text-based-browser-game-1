import type { Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler, Request } from "express"

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
  alias: string | null | undefined
}

export interface AuthProvider {
  /**
   * Middlewares to integrate with Express.
   * They mostly setup for parseAuth after.
   */
  parseTokenMiddleware: () => RequestHandler
  /**
   * Gets auth information from the request set by parseTokenMiddleware.
   */
  parseAuthStatus: (args: { req: Request }) => AuthStatus
  /**
   * Gets the user data from the 3rd party auth service
   */
  fetchUser: (args: { authId: string }) => Promise<Result<User, string>>
}
