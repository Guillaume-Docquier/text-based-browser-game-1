import express, { type Express } from "express"
import { createGamesRouter } from "./games/games.router.ts"
import { GamesController } from "./games/games.controller.ts"
import { recordPlayerMiddleware } from "#auth/recordPlayerMiddleware.ts"
import type { GamesRepository } from "#db/GamesRepository.ts"
import type { PlayersRepository } from "#db/PlayersRepository.ts"
import type { AuthService } from "#auth/auth.service.ts"
import type { Logger } from "@guillaume-docquier/tools-ts"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import { createTrpc, createTrpcContext } from "./trpc.ts"

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

  const gamesController = new GamesController({ gamesRepository })

  const app = express()
  app.use(requestLoggerMiddleware({ logger: appLogger }))
  app.use(authService.authenticationMiddleware())
  app.use(recordPlayerMiddleware({ playersRepository, authService }))

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createTrpcRouter({ gamesController, authService, logger: appLogger }),
      createContext: createTrpcContext,
    }),
  )

  return app
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter({
  gamesController,
  authService,
  logger,
}: {
  gamesController: GamesController
  authService: AuthService
  logger: Logger
}) {
  const trpc = createTrpc()

  return trpc.t.router({
    games: createGamesRouter({ ...trpc, gamesController, authService, logger }),
  })
}
