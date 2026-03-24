import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { RequestHandler } from "express"
import { clerkClient, getAuth } from "@clerk/express"
import { usersTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import type { User } from "#db/types.ts"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      user?: User | undefined
    }
  }
}

export function recordUserMiddleware({ db }: { db: NodePgDatabase }): RequestHandler {
  return async (req, res, next) => {
    const auth = getAuth(req)
    if (!auth.isAuthenticated) {
      next()
      return
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.clerk_id, auth.userId))
    if (user === undefined) {
      const clerkUser = await clerkClient.users.getUser(auth.userId)
      user = (
        await db
          .insert(usersTable)
          .values({ clerk_id: auth.userId, email: clerkUser.emailAddresses[0]?.emailAddress.toLowerCase() })
          .returning()
      )[0]
    }

    req.user = user

    next()
  }
}
