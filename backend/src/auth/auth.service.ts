import type { RequestHandler, Request } from "express"
import { clerkClient, clerkMiddleware, getAuth, type SessionAuthObject, type User } from "@clerk/express"
import type { PlayerRow, PlayersRepository } from "#src/players/players.repository.ts"

// If we hooked this into trpc, we'd have better guarantees.
// I just don't really know how to adapt clerk to trpc yet. For now this does the job.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      player?: PlayerRow | undefined
    }
  }
}

/**
 * Encapsulates Clerk.
 * This should be the only place we use Clerk directly.
 *
 * It'll make tests easier, and if Clerk turns out to be a problem we can change it.
 */
export class AuthService {
  private readonly playersRepository: PlayersRepository

  public constructor({ playersRepository }: { playersRepository: PlayersRepository }) {
    this.playersRepository = playersRepository
  }

  /**
   * Express middleware that parses the authentication token for further usage.
   * Use this in combination with {@link requiresAuth} or {@link getAuth}.
   */
  public authenticationMiddlewares(): RequestHandler[] {
    return [clerkMiddleware(), this.recordPlayerMiddleware()]
  }

  /**
   * Express middleware that returns 401 unless the user is authenticated.
   * Relies on the {@link authenticationMiddlewares} to be registered before using {@link requiresAuth}.
   */
  public requiresAuth(): RequestHandler {
    return (req, res, next) => {
      const auth = this.getAuth(req)
      if (!auth.isAuthenticated) {
        res.status(401).end()
      } else {
        next()
      }
    }
  }

  /**
   * Gets authentication information from the auth token.
   * Relies on the {@link authenticationMiddlewares} to be registered before using {@link getAuth}.
   * This returns poorer data than {@link getUser}.
   */
  public getAuth(req: Request): SessionAuthObject {
    return getAuth(req)
  }

  /**
   * Gets complete authentication information for a given authenticated user.
   * This returns richer data than {@link getAuth}.
   */
  public async getUser({ authId }: { authId: string }): Promise<User> {
    return await clerkClient.users.getUser(authId)
  }

  /**
   * Records authenticated players to our players database if they aren't already.
   *
   * This is an abstraction over Clerk, because we can't full rely on their webhooks to sync data.
   */
  private recordPlayerMiddleware(): RequestHandler {
    return async (req, res, next) => {
      const auth = this.getAuth(req)
      if (!auth.isAuthenticated) {
        next()
        return
      }

      let player = await this.playersRepository.findByAuthId({ authId: auth.userId })
      if (player === undefined) {
        const clerkUser = await this.getUser({ authId: auth.userId })
        player = await this.playersRepository.insert({
          clerk_id: auth.userId,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          alias: clerkUser.fullName,
        })
      }

      req.player = player

      next()
    }
  }
}
