import express from "express"
import { parseEnv } from "./parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { gamesTable } from "./db/schema.ts"
import { eq, sql } from "drizzle-orm"
import { clerkMiddleware, getAuth } from "@clerk/express"

const env = parseEnv()

const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
    // I probably want ssl?
    // ssl: true,
  },
})

async function main(): Promise<void> {
  const [game] = await db.select().from(gamesTable)
  if (game === undefined) {
    throw new Error("There are no games in the database.")
  }
  console.log("Game found", { game })

  const app = express()
  app.use(clerkMiddleware())

  app.get("/api/tick", async (req, res) => {
    const [ngame] = await db.select({ tick: gamesTable.tick }).from(gamesTable).where(eq(gamesTable.id, game.id))
    if (ngame === undefined) {
      return res.status(500).send({ error: "Could not get tick" })
    }

    const tick = ngame.tick
    console.log("GET tick", { tick })
    return res.send({ tick })
  })

  app.post("/api/tick", async (req, res) => {
    // Make this a middleware or something
    const auth = getAuth(req)
    if (!auth.isAuthenticated) {
      return res.status(401).end()
    }

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
  app.listen(port, () => {
    console.log(`App listening on port ${port}`)
  })
}

void main()
