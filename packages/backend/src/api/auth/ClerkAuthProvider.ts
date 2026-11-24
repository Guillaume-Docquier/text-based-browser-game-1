import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler, Request } from "express"
import { z } from "zod"
import type { AuthProvider, AuthStatus, User } from "#api/auth/AuthProvider.ts"
import { FetchUserError } from "#api/auth/fetchUser.error.ts"

export class ClerkAuthProvider implements AuthProvider {
  private readonly logger: Logger

  public constructor({ logger }: { logger: Logger }) {
    this.logger = logger
  }

  public parseTokenMiddleware(): RequestHandler {
    return clerkMiddleware()
  }

  public parseAuthStatus({ req }: { req: Request }): AuthStatus {
    const auth = getAuth(req)
    if (!auth.isAuthenticated) {
      return { isAuthenticated: false }
    }

    return { isAuthenticated: true, authId: auth.userId }
  }

  public async authenticateSessionToken(token: string): Promise<AuthStatus> {
    if (!z.jwt().safeParse(token).success) {
      return { isAuthenticated: false }
    }

    const result = await Result.tryCatch(async () => {
      const request = new Request("http://localhost", { headers: { Authorization: `Bearer ${token}` } })
      return await clerkClient.authenticateRequest(request)
    })
    if (Result.isFailure(result)) {
      this.logger.error("Could not authenticate WebSocket session", { error: result.error })
      return { isAuthenticated: false }
    }

    const auth = result.value.toAuth()
    return auth?.isAuthenticated === true && auth.userId !== null
      ? { isAuthenticated: true, authId: auth.userId }
      : { isAuthenticated: false }
  }

  public async fetchUser({ authId }: { authId: string }): Promise<Result<User, FetchUserError>> {
    const clerkUserResult = await Result.tryCatch(clerkClient.users.getUser(authId))
    if (Result.isFailure(clerkUserResult)) {
      this.logger.error("Could not get user data from clerk", { authId, error: clerkUserResult.error })
      return Result.Failure(FetchUserError.UNKNOWN)
    }

    return Result.Success({
      email: clerkUserResult.value.primaryEmailAddress?.emailAddress,
    })
  }
}
