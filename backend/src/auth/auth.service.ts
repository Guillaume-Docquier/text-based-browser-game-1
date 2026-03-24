import type { RequestHandler, Request } from "express"
import { clerkClient, clerkMiddleware, getAuth, type SessionAuthObject, type User } from "@clerk/express"

export class AuthService {
  /**
   * Express middleware that parses the authentication token for further usage.
   * Use this in combination with {@link requiresAuth} or {@link getAuth}.
   */
  public authenticationMiddleware(): RequestHandler {
    return clerkMiddleware()
  }

  /**
   * Express middleware that returns 401 unless the user is authenticated.
   * Relies on the {@link authenticationMiddleware} to be registered before using {@link requiresAuth}.
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
   * Relies on the {@link authenticationMiddleware} to be registered before using {@link getAuth}.
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
}
