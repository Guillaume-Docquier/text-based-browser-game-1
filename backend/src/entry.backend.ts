import express, { type RequestHandler } from "express"
import { parseEnv } from "./parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { gamesTable, usersTable } from "./db/schema.ts"
import { eq, sql } from "drizzle-orm"
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express"
import type { User } from "./db/types.ts"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- This is the way with Express
  namespace Express {
    interface Request {
      user?: User | undefined
    }
  }
}

const env = parseEnv()

const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
    // I probably want ssl?
    // ssl: true,
  },
})

const recordUserMiddleware: RequestHandler = async (req, res, next) => {
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

const authApi: RequestHandler = (req, res, next) => {
  const auth = getAuth(req)
  if (!auth.isAuthenticated) {
    res.status(401).end()
  } else {
    next()
  }
}

void main()
async function main(): Promise<void> {
  const [game] = await db.select().from(gamesTable)
  if (game === undefined) {
    throw new Error("There are no games in the database.")
  }
  console.log("Game found", { game })

  const app = express()
  app.use(clerkMiddleware())
  app.use(recordUserMiddleware)

  app.get("/tick", async (req, res) => {
    const [ngame] = await db.select({ tick: gamesTable.tick }).from(gamesTable).where(eq(gamesTable.id, game.id))
    if (ngame === undefined) {
      return res.status(500).send({ error: "Could not get tick" })
    }

    const tick = ngame.tick
    console.log("GET tick", { tick })
    return res.send({ tick })
  })

  app.post("/tick", authApi, async (req, res) => {
    const [ngame] = await db
      .update(gamesTable)
      .set({ tick: sql`${gamesTable.tick} + 1` })
      .where(eq(gamesTable.id, game.id))
      .returning()

    if (ngame === undefined) {
      return res.status(500).send({ error: "Could not update tick" })
    }

    const tick = ngame.tick
    console.log("POST tick", { tick })
    return res.send({ tick })
  })

  const port = env.PORT
  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(port, "::", () => {
    console.log(`App listening on port ${port}`)
  })
}
