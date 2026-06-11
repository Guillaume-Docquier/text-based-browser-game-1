import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { LobbyDto } from "#api/lobbies/gameLobbies.controller.ts"
import type { Trpc } from "#api/trpc.ts"
import { type GamesController } from "./games.controller.ts"

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
     * Gets all game lobbies, and eventually will support queries (by name, by state, etc) and pagination
     */
    getGameLobbies: trpc.publicProcedure.output(z.array(LobbyDto)).query(async ({ ctx: { account } }) => {
      const games = await gamesController.getGameLobbies({ playerId: account?.id })

      gamesRouterLogger.info("GET games", { count: games.length })
      return games
    }),

    /**
     * Starts a game, if possible.
     */
    start: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(LobbyDto)
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
