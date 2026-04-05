import type { AuthService } from "#auth/auth.service.ts"
import { Game, GameInsert, type GamesController } from "./games.controller.ts"
import type { Logger } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "../trpc.ts"

/**
 * Import side effect free express router creator.
 * It receives all dependencies so we can easily mock them during tests.
 * It also decouples the router from those dependencies, if done well.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createGamesRouter({
  t,
  publicProcedure,
  authProcedure,
  gamesController,
  logger,
}: Trpc & {
  gamesController: GamesController
  authService: AuthService
  logger: Logger
}) {
  const gamesRouterLogger = logger.child({ scope: "games-router" })

  return t.router({
    /**
     * Creates a new game.
     */
    create: authProcedure
      .input(z.object({ newGame: GameInsert.omit({ createdByPlayerId: true }) }))
      .output(z.object({ newGame: Game }))
      .mutation(async ({ input: { newGame }, ctx: { player } }) => {
        return { newGame: await gamesController.create({ ...newGame, createdByPlayerId: player.id }) }
      }),

    /**
     * Gets all games, and eventually will support queries (by name, by state, etc) and pagination
     */
    getAll: publicProcedure.output(z.object({ games: z.array(Game) })).query(async () => {
      const games = await gamesController.getAll()

      gamesRouterLogger.info("GET games", { count: games.length })
      return { games }
    }),

    /**
     * Gets a game by id
     */
    getById: publicProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ game: Game }))
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
}
