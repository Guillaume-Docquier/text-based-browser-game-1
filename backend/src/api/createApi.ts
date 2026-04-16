import express, { type Express } from "express"
import { createGamesRouter } from "./games/games.router.ts"
import { GamesController } from "./games/games.controller.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import type { AuthService } from "./auth/auth.service.ts"
import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import { createTrpc, createTrpcContext } from "./trpc.ts"
import { createGameStatesRouter } from "#api/gameStates/gameStates.router.ts"
import { GameStatesController } from "#api/gameStates/gameStates.controller.ts"
import type { TRPCError } from "@trpc/server"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { PlayersController } from "#api/players/players.controller.ts"
import type { PlayersRepository } from "#lib/db/players.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"

/**
 * Import side effect free express app creator.
 * It receives all dependencies that talk to the outside world (auth, db) so we can easily mock them during tests.
 * It also decouples the application from those 3rd parties, if done well.
 */
export async function createApi({
  authService,
  ...services
}: {
  authService: AuthService
  logger: Logger
  playersRepository: PlayersRepository
  gamesRepository: GamesRepository
  gameStatesRepository: GameStatesRepository
  gamePlayerResourcesRepository: GamePlayerResourcesRepository
}): Promise<Express> {
  const controllers = {
    gamesController: new GamesController(services),
    gameStatesController: new GameStatesController(services),
    playersController: new PlayersController(services),
  }

  const app = express()
  app.use(requestLoggerMiddleware(services))
  app.use(...authService.authenticationMiddlewares(controllers))

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createTrpcRouter({ ...controllers, ...services }),
      createContext: createTrpcContext,
      onError: createErrorHandler({ logger: services.logger }),
    }),
  )

  return app
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter(services: { gamesController: GamesController; gameStatesController: GameStatesController; logger: Logger }) {
  const trpc = createTrpc()
  const routerServices = { ...trpc, ...services }

  return trpc.t.router({
    games: createGamesRouter(routerServices),
    gameStates: createGameStatesRouter(routerServices),
  })
}

/**
 * trpc catches all errors and doesn't log them.
 * We want to log unexpected errors, which trpc will return as "INTERNAL_SERVER_ERROR".
 *
 * Does nothing to other kinds of errors, since they are expected errors (thrown by routers.)
 */
function createErrorHandler({ logger }: { logger: Logger }) {
  return ({ error }: { error: TRPCError }): void => {
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
  }
}
