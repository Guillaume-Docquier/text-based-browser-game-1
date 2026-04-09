import express, { type Express } from "express"
import { createGamesRouter } from "./games/games.router.ts"
import { GamesController } from "./games/games.controller.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import type { AuthService } from "./auth/auth.service.ts"
import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import { createTrpc, createTrpcContext } from "./trpc.ts"

/**
 * Import side effect free express app creator.
 * It receives all dependencies that talk to the outside world (auth, db) so we can easily mock them during tests.
 * It also decouples the application from those 3rd parties, if done well.
 */
export async function createApi({
  logger,
  gamesRepository,
  authService,
}: {
  logger: Logger
  gamesRepository: GamesRepository
  authService: AuthService
}): Promise<Express> {
  const gamesController = new GamesController({ gamesRepository, logger })

  const app = express()
  app.use(requestLoggerMiddleware({ logger }))
  app.use(...authService.authenticationMiddlewares())

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createTrpcRouter({ gamesController, authService, logger }),
      createContext: createTrpcContext,
      onError({ error }) {
        // Let's not leak stack traces
        delete error.stack

        // Nothing to do for plausible trpc errors
        if (error.code !== "INTERNAL_SERVER_ERROR") {
          return
        }

        // Not sure how that happens?
        if (error.cause === undefined) {
          return
        }

        // Let bad things kill the server
        Rethrow.ifFatal(error.cause)

        // Log uncaught errors for visibility
        logger.error("Uncaught error", { error: error.cause })
      },
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
