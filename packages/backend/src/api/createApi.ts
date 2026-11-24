import type { Server } from "node:http"
import { type Logger, Rethrow } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import { applyWSSHandler } from "@trpc/server/adapters/ws"
import compression from "compression"
import express, { type Express } from "express"
import { v4 } from "uuid"
import { WebSocketServer } from "ws"
import type { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { createAccountsRouter } from "#api/accounts/accounts.router.ts"
import { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"
import type { AuthService } from "#api/auth/auth.service.ts"
import type { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"
import { createGameplayRouter } from "#api/gameplay/gameplay.router.ts"
import { GetPlayerViewUseCase } from "#api/gameplay/getPlayerView.useCase.ts"
import { TurnStateUseCase } from "#api/gameplay/turnState.useCase.ts"
import { UpdateReadinessUseCase } from "#api/gameplay/updateReadiness.useCase.ts"
import { CreateGameUseCase } from "#api/games/createGame.useCase.ts"
import type { GamesRepository } from "#api/games/games.repository.ts"
import { createGamesRouter } from "#api/games/games.router.ts"
import { GetGameDetailsUseCase } from "#api/games/getGameDetailsUseCase.ts"
import { GetGameListingsUseCase } from "#api/games/getGameListings.useCase.ts"
import { JoinGameUseCase } from "#api/games/joinGame.useCase.ts"
import { LeaveGameUseCase } from "#api/games/leaveGame.useCase.ts"
import { StartGameUseCase } from "#api/games/startGame.useCase.ts"
import { createHealthRouter } from "#api/health/health.router.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TurnStateListener } from "#lib/db/TurnStateListener.ts"
import { createTrpc, createTrpcContext, type TrpcContext } from "./trpc.ts"

export type Api = {
  api: Express
  attachWebSocket: (server: Server) => () => void
  startTurnStateListener: (databaseUrl: string) => Promise<AsyncDisposable>
}

export async function createApi({
  createTransaction,
  authService,
  ...services
}: {
  createTransaction: CreateTransaction
  authService: AuthService
  logger: Logger
  clock: Clock
  accountsRepository: AccountsRepository
  gamesRepository: GamesRepository
  gameplayRepository: GameplayRepository
}): Promise<Api> {
  const applicationServices = { ...services, createTransaction }
  const turnStateUseCase = new TurnStateUseCase(services)
  const useCases = {
    turnStateUseCase,
    finishOnboardingUseCase: new FinishOnboardingUseCase(applicationServices),
    getGameListingsUseCase: new GetGameListingsUseCase(applicationServices),
    createGameUseCase: new CreateGameUseCase(applicationServices),
    getGameDetailsUseCase: new GetGameDetailsUseCase(applicationServices),
    joinGameUseCase: new JoinGameUseCase(applicationServices),
    leaveGameUseCase: new LeaveGameUseCase(applicationServices),
    getPlayerViewUseCase: new GetPlayerViewUseCase(applicationServices),
    startGameUseCase: new StartGameUseCase(applicationServices),
    updateReadinessUseCase: new UpdateReadinessUseCase(applicationServices),
  }

  const router = createTrpcRouter({ ...useCases, ...services })
  const onError = createErrorHandler({ logger: services.logger })
  const app = express()
  app.use(compression())
  app.use(...authService.authenticationMiddlewares())

  app.use(
    "/trpc",
    createExpressMiddleware({
      router,
      createContext: createTrpcContext,
      onError,
    }),
  )

  app.use(createHealthRouter())

  return {
    api: app,
    startTurnStateListener: async (databaseUrl) => await startTurnStateListener(databaseUrl, services.logger, turnStateUseCase),
    attachWebSocket: (server) => {
      const wss = new WebSocketServer({ server, path: "/trpc", maxPayload: 64 * 1024 })
      applyWSSHandler({
        wss,
        router,
        onError,
        keepAlive: { enabled: true, pingMs: 30_000, pongWaitMs: 5_000 },
        createContext: async ({ info }): Promise<TrpcContext> => ({
          account: await authService.authenticateSessionToken(info.connectionParams?.token),
          requestId: v4(),
          transport: "websocket",
        }),
      })

      return () => {
        for (const client of wss.clients) {
          client.terminate()
        }
        wss.close()
      }
    },
  }
}

async function startTurnStateListener(databaseUrl: string, logger: Logger, turnState: TurnStateUseCase): Promise<AsyncDisposable> {
  const listener = new TurnStateListener({ databaseUrl, logger })
  const lifetime = new AbortController()
  const ready = Promise.withResolvers<undefined>()
  const run = listener.listen({
    signal: lifetime.signal,
    onListening: () => {
      turnState.refreshAll()
      ready.resolve(undefined)
    },
    onChange: (gameId) => {
      turnState.refresh(gameId)
    },
  })
  await ready.promise
  return {
    async [Symbol.asyncDispose](): Promise<void> {
      lifetime.abort()
      await run
    },
  }
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
  getGameDetailsUseCase: GetGameDetailsUseCase
  joinGameUseCase: JoinGameUseCase
  leaveGameUseCase: LeaveGameUseCase
  gamesRepository: GamesRepository
  getPlayerViewUseCase: GetPlayerViewUseCase
  turnStateUseCase: TurnStateUseCase
  startGameUseCase: StartGameUseCase
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

// CONSTRAINT: trpc catches all errors and doesn't log them. We want to log unexpected errors, which trpc returns as "INTERNAL_SERVER_ERROR".
function createErrorHandler({ logger }: { logger: Logger }) {
  return ({ error }: { error: TRPCError }): void => {
    if (error.code !== "INTERNAL_SERVER_ERROR") {
      return
    }

    if (error.cause === undefined) {
      return
    }

    Rethrow.ifFatal(error.cause)

    logger.error("Uncaught error", { error: error.cause })
  }
}
