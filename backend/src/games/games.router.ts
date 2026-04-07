import type { AuthService } from "#auth/auth.service.ts"
import { CreatedGame, GameInsert, type GamesController, GameSummary } from "./games.controller.ts"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
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
  privateProcedure,
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
    create: privateProcedure
      .input(z.object({ newGame: GameInsert.omit({ createdByPlayerId: true }) }))
      .output(z.object({ newGame: CreatedGame }))
      .mutation(async ({ input: { newGame }, ctx: { player } }) => {
        const createResult = await gamesController.create({ ...newGame, createdByPlayerId: player.id })
        if (Result.isFailure(createResult)) {
          gamesRouterLogger.error("Could not create game.", { newGame, playerId: player.id, error: createResult.error })
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game could not be created.",
          })
        }

        return { newGame: createResult.value }
      }),

    /**
     * Gets all games, and eventually will support queries (by name, by state, etc) and pagination
     */
    getAll: publicProcedure.output(z.object({ games: z.array(GameSummary) })).query(async ({ ctx: { player } }) => {
      const games = await gamesController.getSummaries({ playerId: player?.id })

      gamesRouterLogger.info("GET games", { count: games.length })
      return { games }
    }),

    /**
     * Gets a game by id
     */
    getById: publicProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ game: GameSummary }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const game = await gamesController.getSummaryById({ gameId, playerId: player?.id })
        gamesRouterLogger.info(`GET game ${gameId}`, { game })

        if (game === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game exists with id ${gameId}}`,
          })
        }

        return { game }
      }),

    /**
     * Joins a game, if possible.
     */
    join: privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ joinedGame: GameSummary }))
      .mutation(async ({ input: { gameId }, ctx: { player } }) => {
        const joinGameResult = await gamesController.join({ gameId, playerId: player.id })
        if (Result.isFailure(joinGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: joinGameResult.error,
          })
        }

        return { joinedGame: joinGameResult.value }
      }),

    /**
     * Leaves a game, if possible.
     */
    leave: privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ leftGame: GameSummary }))
      .mutation(async ({ input: { gameId }, ctx: { player } }) => {
        const leaveGameResult = await gamesController.leave({ gameId, playerId: player.id })
        if (Result.isFailure(leaveGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: leaveGameResult.error,
          })
        }

        return { leftGame: leaveGameResult.value }
      }),
  })
}
