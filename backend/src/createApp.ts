import express, { type Express } from "express"
import { clerkMiddleware } from "@clerk/express"
import { createGameRouter } from "./game/game.router.ts"
import { GameController } from "./game/game.controller.ts"
import { recordUserMiddleware } from "./auth/recordUserMiddleware.ts"
import type { GamesRepository } from "#db/GamesRepository.ts"
import type { UsersRepository } from "#db/UsersRepository.ts"

export async function createApp({
  gamesRepository,
  usersRepository,
}: {
  gamesRepository: GamesRepository
  usersRepository: UsersRepository
}): Promise<Express> {
  const [game] = await gamesRepository.getAll()
  if (game === undefined) {
    throw new Error("There are no games in the database.")
  }
  console.log("Game found", { game })

  const gameService = new GameController({ gamesRepository, gameId: game.id })

  const app = express()
  app.use(clerkMiddleware())
  app.use(recordUserMiddleware({ usersRepository }))

  app.use(createGameRouter({ gameController: gameService }))

  return app
}
