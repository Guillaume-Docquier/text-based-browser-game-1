import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { GameStateDto, type GameStatesController } from "#api/gameStates/gameStates.controller.ts"
import type { Trpc } from "#api/trpc.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameStatesRouter({ trpc, gameStatesController }: { trpc: Trpc; gameStatesController: GameStatesController }) {
  return trpc.router({
    /**
     * Gets the state for a game if it exists.
     */
    getById: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ gameState: GameStateDto }))
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getByIdResult = await gameStatesController.getById({ gameId, playerId: account.id })
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
