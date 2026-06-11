import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import express, { type Express } from "express"
import { AccountsController } from "#api/accounts/accounts.controller.ts"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import type { IAuthService } from "#api/accounts/auth.service.ts"
import { type GameListingsRepository } from "#api/game-listings/gameListings.repository.ts"
import { type GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { GamePlayerActionsController } from "#api/gamePlayerActions/gamePlayerActions.controller.ts"
import { createGamePlayerActionsRouter } from "#api/gamePlayerActions/gamePlayerActions.router.ts"
import { GameStatesController } from "#api/gameStates/gameStates.controller.ts"
import { createGameStatesRouter } from "#api/gameStates/gameStates.router.ts"
import { LobbiesController } from "#api/lobbies/lobbies.controller.ts"
import { type LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { createLobbiesRouter } from "#api/lobbies/lobbies.router.ts"
import { StarSystemsController } from "#api/star-systems/starSystems.controller.ts"
import { createStarSystemsRouter } from "#api/star-systems/starSystems.router.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import type { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { GamesController } from "./games/games.controller.ts"
import { createGamesRouter } from "./games/games.router.ts"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import { createTrpc, createTrpcContext } from "./trpc.ts"

/**
 * Import side effect free express app creator.
 * It receives all dependencies that talk to the outside world (createTransaction, authService) so we can easily mock them during tests.
 * It also decouples the application from those 3rd parties, if done well.
 */
export async function createApi({
  createTransaction,
  authService,
  ...services
}: {
  /**
   * Creates a database transaction.
   * Only controllers should use `createTransaction`.
   */
  createTransaction: CreateTransaction
  authService: IAuthService
  logger: Logger
  accountsRepository: AccountsRepository
  gamesRepository: GamesRepository
  gameStatesRepository: GameStatesRepository
  gameTicksRepository: GameTicksRepository
  gamePlayerResourcesRepository: GamePlayerResourcesRepository
  gamePlayerActionsRepository: GamePlayerActionsRepository
  starSystemsRepository: StarSystemsRepository
  gameListingsRepository: GameListingsRepository
  lobbiesRepository: LobbiesRepository
  gameplayRepository: GameplayRepository
}): Promise<Express> {
  const controllerServices = { ...services, createTransaction }
  const controllers = {
    gamesController: new GamesController(controllerServices),
    lobbiesController: new LobbiesController(controllerServices),
    gameStatesController: new GameStatesController(controllerServices),
    accountsController: new AccountsController(controllerServices),
    gamePlayerActionsController: new GamePlayerActionsController(controllerServices),
    starSystemsController: new StarSystemsController(controllerServices),
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
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter(services: {
  gamesController: GamesController
  lobbiesController: LobbiesController
  gameStatesController: GameStatesController
  gamePlayerActionsController: GamePlayerActionsController
  starSystemsController: StarSystemsController
  logger: Logger
}) {
  const trpc = createTrpc()
  const routerServices = { trpc, ...services }

  return trpc.router({
    games: createGamesRouter(routerServices),
    lobbies: createLobbiesRouter(routerServices),
    gameStates: createGameStatesRouter(routerServices),
    gamePlayerActions: createGamePlayerActionsRouter(routerServices),
    starSystems: createStarSystemsRouter(routerServices),
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
