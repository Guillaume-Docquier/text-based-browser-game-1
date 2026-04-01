import express, { type Express } from "express"
import { createGamesRouter } from "./game/games.router.ts"
import { GamesController } from "./game/games.controller.ts"
import { recordPlayerMiddleware } from "#auth/recordPlayerMiddleware.ts"
import type { GamesRepository } from "#db/GamesRepository.ts"
import type { PlayersRepository } from "#db/PlayersRepository.ts"
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
  playersRepository,
  authService,
}: {
  logger: Logger
  gamesRepository: GamesRepository
  playersRepository: PlayersRepository
  authService: AuthService
}): Promise<Express> {
  const appLogger = logger.child({ scope: "app" })

  const gameController = new GamesController({ gamesRepository })

  const app = express()
  app.use(authService.authenticationMiddleware())
  app.use(recordPlayerMiddleware({ playersRepository, authService }))

  app.use("/games", createGamesRouter({ gameController, authService, logger: appLogger }))

  return app
}
