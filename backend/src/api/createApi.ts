import express, { type Express } from "express"
import { createGamesRouter } from "./games/games.router.ts"
import { GamesService } from "./games/games.service.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import type { IAuthService } from "./auth/auth.service.ts"
import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import { createTrpc, createTrpcContext } from "./trpc.ts"
import { createGameStatesRouter } from "#api/gameStates/gameStates.router.ts"
import { GameStatesService } from "#api/gameStates/gameStates.service.ts"
import type { TRPCError } from "@trpc/server"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { PlayersService } from "#api/players/players.service.ts"
import type { PlayersRepository } from "#lib/db/players.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import type { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import { GamePlayerActionsService } from "#api/gamePlayerActions/gamePlayerActions.service.ts"
import { createGamePlayerActionsRouter } from "#api/gamePlayerActions/gamePlayerActions.router.ts"

/**
 * Import side effect free express app creator.
 * It receives all dependencies that talk to the outside world (auth, db) so we can easily mock them during tests.
 * It also decouples the application from those 3rd parties, if done well.
 */
export async function createApi({
  authService,
  ...dependencies
}: {
  authService: IAuthService
  logger: Logger
  playersRepository: PlayersRepository
  gamesRepository: GamesRepository
  gameStatesRepository: GameStatesRepository
  gamePlayerResourcesRepository: GamePlayerResourcesRepository
  gamePlayerActionsRepository: GamePlayerActionsRepository
}): Promise<Express> {
  const services = {
    gamesService: new GamesService(dependencies),
    gameStatesService: new GameStatesService(dependencies),
    playersService: new PlayersService(dependencies),
    gamePlayerActionsService: new GamePlayerActionsService(dependencies),
  }

  const app = express()
  app.use(requestLoggerMiddleware(dependencies))
  app.use(...authService.authenticationMiddlewares(services))

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createTrpcRouter({ ...services, ...dependencies }),
      createContext: createTrpcContext,
      onError: createErrorHandler({ logger: dependencies.logger }),
    }),
  )

  return app
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter(services: {
  gamesService: GamesService
  gameStatesService: GameStatesService
  gamePlayerActionsService: GamePlayerActionsService
  logger: Logger
}) {
  const trpc = createTrpc()
  const routerServices = { trpc, ...services }

  return trpc.router({
    games: createGamesRouter(routerServices),
    gameStates: createGameStatesRouter(routerServices),
    gamePlayerActions: createGamePlayerActionsRouter(routerServices),
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
