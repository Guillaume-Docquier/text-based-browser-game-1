import express, { type Express } from "express"
import { createGamesRouter } from "./games/games.router.ts"
import { Game, GamesController } from "./games/games.controller.ts"
import { recordPlayerMiddleware } from "#auth/recordPlayerMiddleware.ts"
import type { GamesRepository } from "#db/GamesRepository.ts"
import type { PlayersRepository } from "#db/PlayersRepository.ts"
import type { AuthService } from "#auth/auth.service.ts"
import type { Logger } from "@guillaume-docquier/tools-ts"
import { type CreateExpressContextOptions, createExpressMiddleware } from "@trpc/server/adapters/express"
import { initTRPC, TRPCError } from "@trpc/server"
import { requestLoggerMiddleware } from "./requestLoggerMiddleware.ts"
import z from "zod"

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
  app.use(requestLoggerMiddleware({ logger: appLogger }))
  app.use(authService.authenticationMiddleware())
  app.use(recordPlayerMiddleware({ playersRepository, authService }))

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: createAppRouter({ gamesController: gameController, logger: appLogger }),
      createContext,
    }),
  )

  app.use("/games", createGamesRouter({ gamesController: gameController, authService, logger: appLogger }))

  return app
}

type ExpressContextOptions = Pick<CreateExpressContextOptions, "req" | "res">

const createContext = ({ req, res }: ExpressContextOptions): ExpressContextOptions => {
  return {
    req,
    res,
  }
}

type Context = Awaited<ReturnType<typeof createContext>>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- We leverage inference for trpc, that's how they're designed
function createAppRouter({ gamesController, logger }: { gamesController: GamesController; logger: Logger }) {
  const t = initTRPC.context<Context>().create()
  const publicProcedure = t.procedure

  const gamesRouterLogger = logger.child({ scope: "games-router" })
  const gamesRouter = t.router({
    getAll: publicProcedure
      .output(
        z.object({
          games: z.array(Game),
        }),
      )
      .query(async () => {
        const games = await gamesController.getAll()

        gamesRouterLogger.info("GET games", { count: games.length })
        return { games }
      }),
    getById: publicProcedure
      .input(
        z.object({
          gameId: z.coerce.number(),
        }),
      )
      .output(
        z.object({
          game: Game.or(z.undefined()),
        }),
      )
      .query(async ({ input: { gameId } }) => {
        const game = await gamesController.findById({ gameId })
        gamesRouterLogger.info(`GET game ${gameId}`, { game })

        if (game === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Game not found",
            cause: `No game exists with id ${gameId}}`,
          })
        }

        return { game }
      }),
  })

  return t.router({
    games: gamesRouter,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>
