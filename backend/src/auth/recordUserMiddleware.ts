import type { RequestHandler } from "express"
import type { AuthService } from "#auth/auth.service.ts"
import type { User, UsersRepository } from "#db/UsersRepository.ts"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      user?: User | undefined
    }
  }
}

/**
 * Records authenticated users to our users database if they aren't already.
 *
 * This is a leaky abstraction over Clerk, because we can't full rely on their webhooks to sync data.
 */
export function recordUserMiddleware({
  usersRepository,
  authService,
}: {
  usersRepository: UsersRepository
  authService: AuthService
}): RequestHandler {
  return async (req, res, next) => {
    const auth = authService.getAuth(req)
    if (!auth.isAuthenticated) {
      next()
      return
    }

    let user = await usersRepository.findByAuthId({ authId: auth.userId })
    if (user === undefined) {
      const clerkUser = await authService.getUser({ authId: auth.userId })
      user = await usersRepository.insert({ clerk_id: auth.userId, email: clerkUser.emailAddresses[0]?.emailAddress })
    }

    req.user = user

    next()
  }
}
