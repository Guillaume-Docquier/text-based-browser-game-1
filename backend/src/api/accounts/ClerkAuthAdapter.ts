import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { RequestHandler, Request } from "express"
import type { AuthAdapter, AuthStatus, User } from "#api/accounts/AuthAdapter.ts"
import { couldNot } from "#lib/errors.ts"

export class ClerkAuthAdapter implements AuthAdapter {
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
      return {
        isAuthenticated: auth.isAuthenticated,
      }
    }

    return {
      isAuthenticated: auth.isAuthenticated,
      authId: auth.userId,
    }
  }

  public async fetchUser({ authId }: { authId: string }): Promise<Result<User, string>> {
    const clerkUserResult = await Result.tryCatch(clerkClient.users.getUser(authId))
    if (Result.isFailure(clerkUserResult)) {
      this.logger.error("Could not get user data from clerk", { authId, error: clerkUserResult.error })
      return Result.Failure(couldNot("get user data from clerk"))
    }

    return Result.Success({
      email: clerkUserResult.value.primaryEmailAddress?.emailAddress,
      alias: clerkUserResult.value.fullName,
    })
  }
}
