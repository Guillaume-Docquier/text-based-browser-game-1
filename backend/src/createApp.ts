import express, { type Express } from "express"
import { createGameRouter } from "./game/game.router.ts"
import { GameController } from "./game/game.controller.ts"
import { recordUserMiddleware } from "#auth/recordUserMiddleware.ts"
import type { GamesRepository } from "#db/GamesRepository.ts"
import type { UsersRepository } from "#db/UsersRepository.ts"
import type { AuthService } from "#auth/auth.service.ts"
import type { Logger } from "@guillaume-docquier/tools-ts"

/**
 * Import side effect free express app creator.
 * It receives all dependencies that talk to the outside world (auth, db) so we can easily mock them during tests.
 * It also decouples the application from those 3rd parties, if done well.
 */
export async function createApp({
  logger,
  gamesRepository,
  usersRepository,
  authService,
}: {
  logger: Logger
  gamesRepository: GamesRepository
  usersRepository: UsersRepository
  authService: AuthService
}): Promise<Express> {
  const appLogger = logger.child({ scope: "app" })

  const [game] = await gamesRepository.getAll()
  if (game === undefined) {
    throw new Error("There are no games in the database.")
  }
  appLogger.info("Game found", { game })

  const gameController = new GameController({ gamesRepository, gameId: game.id })

  const app = express()
  app.use(authService.authenticationMiddleware())
  app.use(recordUserMiddleware({ usersRepository, authService }))

  app.use(createGameRouter({ gameController, authService, logger: appLogger }))

  return app
}
