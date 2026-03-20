import express from "express"
import cors from "cors"
import { parseEnv } from "./parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { gamesTable } from "./db/schema.ts"
import { eq } from "drizzle-orm"

const env = parseEnv()

// You can specify any property from the node-postgres connection options
const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
    // I probably want ssl?
    // ssl: true,
  },
})

async function main(): Promise<void> {
  const [game] = await db.select({ tick: gamesTable.tick }).from(gamesTable).where(eq(gamesTable.id, 0))
  console.log(game)

  const app = express()
  app.use(cors({ origin: env.FRONTEND_HOST }))

  let tick = 0

  app.get("/tick", (req, res) => {
    console.log("GET tick", { tick })
    res.send({ tick })
  })

  app.post("/tick", (req, res) => {
    tick++
    console.log("POST tick", { tick })
    res.send({ tick })
  })

  const port = env.PORT
  app.listen(port, () => {
    console.log(`App listening on port ${port}`)
  })
}

void main()
