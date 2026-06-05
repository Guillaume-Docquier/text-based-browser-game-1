import type { RequestHandler } from "express"
import { clerkClient, clerkMiddleware, getAuth, type User } from "@clerk/express"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { PlayerDto, PlayersController } from "#api/players/players.controller.ts"
import { couldNot } from "#lib/errors.ts"

// If we hooked this into trpc, we'd have better guarantees.
// I just don't really know how to adapt clerk to trpc yet. For now this does the job.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      player?: PlayerDto | undefined
    }
  }
}

export interface IAuthService {
  authenticationMiddlewares: ({ playersController }: { playersController: PlayersController }) => RequestHandler[]
}

/**
 * Encapsulates Clerk.
 * This should be the only place we use Clerk directly.
 *
 * It'll make tests easier, and if Clerk turns out to be a problem, we can change it.
 */
export class AuthService implements IAuthService {
  private readonly logger: Logger

  public constructor({ logger }: { logger: Logger }) {
    this.logger = logger.child({ scope: "auth-service" })
  }

  /**
   * Express middleware that parses the authentication token for further usage.
   * The trpc procedures will consume this information.
   */
  public authenticationMiddlewares({ playersController }: { playersController: PlayersController }): RequestHandler[] {
    return [clerkMiddleware(), this.recordPlayerMiddleware({ playersController })]
  }

  /**
   * Gets complete authentication information for a given authenticated user.
   * This returns richer data than {@link getAuth}.
   */
  private async getUser({ authId }: { authId: string }): Promise<Result<User, string>> {
    const getUserResult = await Result.tryCatch(clerkClient.users.getUser(authId))
    if (Result.isFailure(getUserResult)) {
      this.logger.error("Could not get user data from clerk", { authId, error: getUserResult.error })
      return Result.Failure(couldNot("get user data from clerk"))
    }

    return getUserResult
  }

  /**
   * Records authenticated players to our players database if they aren't already.
   *
   * This is an abstraction over Clerk, because we can't full rely on their webhooks to sync data (and we haven't set up one yet anyway).
   */
  private recordPlayerMiddleware({ playersController }: { playersController: PlayersController }): RequestHandler {
    return async (req, res, next) => {
      const auth = getAuth(req)
      if (!auth.isAuthenticated) {
        next()
        return
      }

      const authId = auth.userId
      const findPlayerResult = await playersController.getByAuthId({ authId })
      if (Result.isFailure(findPlayerResult)) {
        this.logger.error("Could not get player from the clerk id", { authId, error: findPlayerResult.error })
        next()
        return
      }

      let player = findPlayerResult.value
      if (player === undefined) {
        const clerkUser = await this.getUser({ authId })
        if (Result.isFailure(clerkUser)) {
          next()
          return
        }

        const insertPlayerResult = await playersController.create({
          clerk_id: authId,
          email: clerkUser.value.primaryEmailAddress?.emailAddress,
          alias: clerkUser.value.fullName,
        })
        if (Result.isFailure(insertPlayerResult)) {
          this.logger.error("Could not record new player", { authId, error: insertPlayerResult.error })
          next()
          return
        }

        player = insertPlayerResult.value
      }

      req.player = player
      next()
    }
  }
}
