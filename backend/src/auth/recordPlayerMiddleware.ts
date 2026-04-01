import type { RequestHandler } from "express"
import type { AuthService } from "#auth/auth.service.ts"
import type { Player, PlayersRepository } from "#db/PlayersRepository.ts"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      player?: Player | undefined
    }
  }
}

/**
 * Records authenticated players to our players database if they aren't already.
 *
 * This is a leaky abstraction over Clerk, because we can't full rely on their webhooks to sync data.
 */
export function recordPlayerMiddleware({
  playersRepository,
  authService,
}: {
  playersRepository: PlayersRepository
  authService: AuthService
}): RequestHandler {
  return async (req, res, next) => {
    const auth = authService.getAuth(req)
    if (!auth.isAuthenticated) {
      next()
      return
    }

    let player = await playersRepository.findByAuthId({ authId: auth.userId })
    if (player === undefined) {
      const clerkUser = await authService.getUser({ authId: auth.userId })
      player = await playersRepository.insert({ clerk_id: auth.userId, email: clerkUser.emailAddresses[0]?.emailAddress })
    }

    req.player = player

    next()
  }
}
