import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import type { GamePlayerActionsController } from "#api/gamePlayerActions/gamePlayerActions.controller.ts"
import type { Trpc } from "#api/trpc.ts"
import { GamePlayerActionSchema, GamePlayerActionTypeSchema } from "#lib/gamePlayerActions.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGamePlayerActionsRouter({
  trpc,
  gamePlayerActionsController,
}: {
  trpc: Trpc
  gamePlayerActionsController: GamePlayerActionsController
}) {
  return trpc.router({
    /**
     * Gets the current action of a player for a given game.
     * Long term you won't have just a single action, and it'll probably be bundled into a single game state query.
     */
    getCurrentAction: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ action: GamePlayerActionSchema.nullable() }))
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getCurrentActionResult = await gamePlayerActionsController.getCurrentAction({ gameId, playerId: account.id })
        if (Result.isFailure(getCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getCurrentActionResult.error,
          })
        }

        return { action: getCurrentActionResult.value }
      }),

    /**
     * Sets the current action of a player for a given game.
     * Long term you won't have just a single action.
     */
    setCurrentAction: trpc.privateProcedure
      .input(
        z.object({
          gameId: z.coerce.number(),
          tick: z.coerce.number(),
          actionType: GamePlayerActionTypeSchema.nullable(),
        }),
      )
      .output(z.object({ action: GamePlayerActionSchema.nullable() }))
      .mutation(async ({ input: { gameId, tick, actionType }, ctx: { account } }) => {
        const setCurrentActionResult = await gamePlayerActionsController.setCurrentAction({
          gameId,
          playerId: account.id,
          tick,
          actionType,
        })
        if (Result.isFailure(setCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: setCurrentActionResult.error,
          })
        }

        return { action: setCurrentActionResult.value }
      }),
  })
}
