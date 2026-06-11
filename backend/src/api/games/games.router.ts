import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import type { Trpc } from "#api/trpc.ts"
import {
  CreatedGameDto,
  CreateGameDto,
  type GamesController,
  GameLobbyDto,
  JoinedGameDto,
  JoinGameDto,
  LeaveGameDto,
  LeftGameDto,
  ListingDto,
} from "./games.controller.ts"

/**
 * Import side effect free express router creator.
 * It receives all dependencies so we can easily mock them during tests.
 * It also decouples the router from those dependencies, if done well.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGamesRouter({ trpc, gamesController, ...others }: { trpc: Trpc; gamesController: GamesController; logger: Logger }) {
  const gamesRouterLogger = others.logger.child({ scope: "games-router" })

  return trpc.router({
    /**
     * Creates a new game.
     */
    create: trpc.privateProcedure
      .input(CreateGameDto.omit({ createdByAccountId: true }))
      .output(CreatedGameDto)
      .mutation(async ({ input: newGame, ctx: { account } }) => {
        const createResult = await gamesController.createGame({ ...newGame, createdByAccountId: account.id })
        if (Result.isFailure(createResult)) {
          gamesRouterLogger.error("Could not create game.", { newGame, playerId: account.id, error: createResult.error })
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game could not be created.",
          })
        }

        return createResult.value
      }),

    /**
     * Gets all game listings, and eventually will support queries (by name, by state, etc) and pagination
     */
    getListings: trpc.publicProcedure.output(z.array(ListingDto)).query(async () => {
      return await gamesController.getListings()
    }),

    /**
     * Gets a game lobby by id
     */
    getGameLobbyById: trpc.publicProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(GameLobbyDto)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const game = await gamesController.getGameLobbyById({ gameId, playerId: account?.id })
        gamesRouterLogger.info(`GET game ${gameId}`, { game })

        if (game === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game exists with id ${gameId}`,
          })
        }

        return game
      }),

    /**
     * Joins a game, if possible.
     */
    join: trpc.privateProcedure
      .input(JoinGameDto.pick({ gameId: true }))
      .output(JoinedGameDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const joinGameResult = await gamesController.joinGameLobby({ gameId, accountId: account.id })
        if (Result.isFailure(joinGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: joinGameResult.error,
          })
        }

        return joinGameResult.value
      }),

    /**
     * Leaves a game, if possible.
     */
    leave: trpc.privateProcedure
      .input(LeaveGameDto.pick({ gameId: true }))
      .output(LeftGameDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const leaveGameResult = await gamesController.leaveGameLobby({ gameId, accountId: account.id })
        if (Result.isFailure(leaveGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: leaveGameResult.error,
          })
        }

        return leaveGameResult.value
      }),

    /**
     * Starts a game, if possible.
     */
    start: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(GameLobbyDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const startGameResult = await gamesController.startGame({ gameId, playerId: account.id })
        if (Result.isFailure(startGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: startGameResult.error,
          })
        }

        return startGameResult.value
      }),
  })
}
