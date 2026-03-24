import express, { type Express } from "express"
import { clerkMiddleware } from "@clerk/express"
import { gamesTable } from "./db/schema.ts"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createGameRouter } from "./game/game.router.ts"
import { GameController } from "./game/game.controller.ts"
import { recordUserMiddleware } from "./auth/recordUserMiddleware.ts"

export async function createApp({ db }: { db: NodePgDatabase }): Promise<Express> {
  const [game] = await db.select().from(gamesTable)
  if (game === undefined) {
    throw new Error("There are no games in the database.")
  }
  console.log("Game found", { game })

  const gameService = new GameController({ db, gameId: game.id })

  const app = express()
  app.use(clerkMiddleware())
  app.use(recordUserMiddleware({ db }))

  app.use(createGameRouter({ gameController: gameService }))

  return app
}
