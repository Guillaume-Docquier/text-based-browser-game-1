import type { RequestHandler } from "express"
import { clerkClient, getAuth } from "@clerk/express"
import type { User, UsersRepository } from "#db/UsersRepository.ts"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      user?: User | undefined
    }
  }
}

export function recordUserMiddleware({ usersRepository }: { usersRepository: UsersRepository }): RequestHandler {
  return async (req, res, next) => {
    const auth = getAuth(req)
    if (!auth.isAuthenticated) {
      next()
      return
    }

    let user = await usersRepository.findByAuthId({ authId: auth.userId })
    if (user === undefined) {
      const clerkUser = await clerkClient.users.getUser(auth.userId)
      user = await usersRepository.insert({ clerk_id: auth.userId, email: clerkUser.emailAddresses[0]?.emailAddress })
    }

    req.user = user

    next()
  }
}
