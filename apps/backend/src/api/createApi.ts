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
import { GetPlayerIdUseCase } from "#api/gameplay/getPlayerId.useCase.ts"
import { GetPlayerViewUseCase } from "#api/gameplay/getPlayerView.useCase.ts"
import { StartGameUseCase } from "#api/gameplay/startGame.useCase.ts"
import { UpdateActionSubmissionUseCase } from "#api/gameplay/updateActionSubmission.useCase.ts"
import { UpdateReadinessUseCase } from "#api/gameplay/updateReadiness.useCase.ts"
import { createHealthRouter } from "#api/health/health.router.ts"
import { GetListingsUseCase } from "#api/listings/getListings.useCase.ts"
import type { ListingsRepository } from "#api/listings/listings.repository.ts"
import { createListingsRouter } from "#api/listings/listings.router.ts"
import { CreateLobbyUseCase } from "#api/lobbies/createLobby.useCase.ts"
import { GetLobbyByIdUseCase } from "#api/lobbies/getLobbyById.useCase.ts"
import { GetLobbyCreationSettingsUseCase } from "#api/lobbies/getLobbyCreationSettings.useCase.ts"
import { JoinLobbyUseCase } from "#api/lobbies/joinLobby.useCase.ts"
import { LeaveLobbyUseCase } from "#api/lobbies/leaveLobby.useCase.ts"
import type { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { createLobbiesRouter } from "#api/lobbies/lobbies.router.ts"
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
  listingsRepository: ListingsRepository
  lobbiesRepository: LobbiesRepository
  gameplayRepository: GameplayRepository
  rulesetsRepository: RulesetsRepository
}): Promise<Express> {
  const applicationServices = { ...services, createTransaction }
  const useCases = {
    finishOnboardingUseCase: new FinishOnboardingUseCase(applicationServices),
    getListingsUseCase: new GetListingsUseCase(applicationServices),
    createLobbyUseCase: new CreateLobbyUseCase(applicationServices),
    getLobbyByIdUseCase: new GetLobbyByIdUseCase(applicationServices),
    getLobbyCreationSettingsUseCase: new GetLobbyCreationSettingsUseCase(applicationServices),
    joinLobbyUseCase: new JoinLobbyUseCase(applicationServices),
    leaveLobbyUseCase: new LeaveLobbyUseCase(applicationServices),
    getPlayerIdUseCase: new GetPlayerIdUseCase(applicationServices),
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
function createTrpcRouter(services: {
  finishOnboardingUseCase: FinishOnboardingUseCase
  getListingsUseCase: GetListingsUseCase
  createLobbyUseCase: CreateLobbyUseCase
  getLobbyByIdUseCase: GetLobbyByIdUseCase
  getLobbyCreationSettingsUseCase: GetLobbyCreationSettingsUseCase
  joinLobbyUseCase: JoinLobbyUseCase
  leaveLobbyUseCase: LeaveLobbyUseCase
  getPlayerIdUseCase: GetPlayerIdUseCase
  getPlayerViewUseCase: GetPlayerViewUseCase
  startGameUseCase: StartGameUseCase
  updateActionSubmissionUseCase: UpdateActionSubmissionUseCase
  updateReadinessUseCase: UpdateReadinessUseCase
  logger: Logger
}) {
  const trpc = createTrpc()
  const routerServices = { trpc, ...services }

  return trpc.router({
    accounts: createAccountsRouter(routerServices),
    gameplay: createGameplayRouter(routerServices),
    listings: createListingsRouter(routerServices),
    lobbies: createLobbiesRouter(routerServices),
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
