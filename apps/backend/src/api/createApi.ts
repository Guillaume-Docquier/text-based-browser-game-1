import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import compression from "compression"
import express, { type Express } from "express"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { createAccountsRouter } from "#api/accounts/accounts.router.ts"
import { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"
import type { AuthService } from "#api/auth/auth.service.ts"
import type { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { createGameplayRouter } from "#api/gameplay/gameplay.router.ts"
import { GetPlayerViewUseCase } from "#api/gameplay/getPlayerView.useCase.ts"
import { UpdateActionSubmissionUseCase } from "#api/gameplay/updateActionSubmission.useCase.ts"
import { UpdateReadinessUseCase } from "#api/gameplay/updateReadiness.useCase.ts"
import { CreateGameUseCase } from "#api/games/createGame.useCase.ts"
import type { GamesRepository } from "#api/games/games.repository.ts"
import { createGamesRouter } from "#api/games/games.router.ts"
import { GetGameByIdUseCase } from "#api/games/getGameById.useCase.ts"
import { GetGameCreationSettingsUseCase } from "#api/games/getGameCreationSettings.useCase.ts"
import { GetGameListingsUseCase } from "#api/games/getGameListings.useCase.ts"
import { JoinGameUseCase } from "#api/games/joinGame.useCase.ts"
import { LeaveGameUseCase } from "#api/games/leaveGame.useCase.ts"
import { StartGameUseCase } from "#api/games/startGame.useCase.ts"
import { createHealthRouter } from "#api/health/health.router.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
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
   * Only use cases should use `createTransaction`.
   */
  createTransaction: CreateTransaction
  authService: AuthService
  logger: Logger
  clock: Clock
  accountsRepository: AccountsRepository
  gamesRepository: GamesRepository
  gameplayRepository: GameplayRepository
  rulesetsRepository: RulesetsRepository
}): Promise<Express> {
  const applicationServices = { ...services, createTransaction }
  const useCases = {
    finishOnboardingUseCase: new FinishOnboardingUseCase(applicationServices),
    getGameListingsUseCase: new GetGameListingsUseCase(applicationServices),
    createGameUseCase: new CreateGameUseCase(applicationServices),
    getGameByIdUseCase: new GetGameByIdUseCase(applicationServices),
    getGameCreationSettingsUseCase: new GetGameCreationSettingsUseCase(applicationServices),
    joinGameUseCase: new JoinGameUseCase(applicationServices),
    leaveGameUseCase: new LeaveGameUseCase(applicationServices),
    getPlayerViewUseCase: new GetPlayerViewUseCase(applicationServices),
    startGameUseCase: new StartGameUseCase(applicationServices),
    updateActionSubmissionUseCase: new UpdateActionSubmissionUseCase(applicationServices),
    updateReadinessUseCase: new UpdateReadinessUseCase(applicationServices),
  }

  const app = express()
  app.use(compression())
  app.use(requestLoggerMiddleware(services))
  app.use(...authService.authenticationMiddlewares())

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createTrpcRouter({ ...useCases, ...services }),
      createContext: createTrpcContext,
      onError: createErrorHandler({ logger: services.logger }),
    }),
  )

  app.use(createHealthRouter())

  return app
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter({
  logger,
  gamesRepository,
  ...services
}: {
  finishOnboardingUseCase: FinishOnboardingUseCase
  getGameListingsUseCase: GetGameListingsUseCase
  createGameUseCase: CreateGameUseCase
  getGameByIdUseCase: GetGameByIdUseCase
  getGameCreationSettingsUseCase: GetGameCreationSettingsUseCase
  joinGameUseCase: JoinGameUseCase
  leaveGameUseCase: LeaveGameUseCase
  gamesRepository: GamesRepository
  getPlayerViewUseCase: GetPlayerViewUseCase
  startGameUseCase: StartGameUseCase
  updateActionSubmissionUseCase: UpdateActionSubmissionUseCase
  updateReadinessUseCase: UpdateReadinessUseCase
  logger: Logger
}) {
  const trpc = createTrpc({ logger, gamesRepository })
  const routerServices = { trpc, logger, ...services }

  return trpc.router({
    accounts: createAccountsRouter(routerServices),
    gameplay: createGameplayRouter(routerServices),
    games: createGamesRouter(routerServices),
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
