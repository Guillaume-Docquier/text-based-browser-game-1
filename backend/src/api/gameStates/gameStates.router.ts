import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import { GameStateDto, type GameStatesController } from "#api/gameStates/gameStates.controller.ts"

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createGameStatesRouter({ trpc, gameStatesController }: { trpc: Trpc; gameStatesController: GameStatesController }) {
  return trpc.router({
    /**
     * Gets the state for a game if it exists.
     */
    getById: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ gameState: GameStateDto }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getByIdResult = await gameStatesController.getById({ gameId, playerId: player.id })
        if (Result.isFailure(getByIdResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getByIdResult.error,
          })
        }

        if (getByIdResult.value === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game state exists with id ${gameId}`,
          })
        }

        return { gameState: getByIdResult.value }
      }),
  })
}
