import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import type { GamePlayerActionsService } from "#api/gamePlayerActions/gamePlayerActions.service.ts"
import { GamePlayerActionSchema, GamePlayerActionTypeSchema } from "#lib/gamePlayerActions.ts"

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createGamePlayerActionsRouter({
  trpc,
  gamePlayerActionsService,
}: {
  trpc: Trpc
  gamePlayerActionsService: GamePlayerActionsService
}) {
  return trpc.router({
    /**
     * Gets the current action of a player for a given game.
     * Long term you won't have just a single action, and it'll probably be bundled into a single game state query.
     */
    getCurrentAction: trpc.privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ action: GamePlayerActionSchema.nullable() }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getCurrentActionResult = await gamePlayerActionsService.getCurrentAction({ gameId, playerId: player.id })
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
      .mutation(async ({ input: { gameId, tick, actionType }, ctx: { player } }) => {
        const setCurrentActionResult = await gamePlayerActionsService.setCurrentAction({ gameId, playerId: player.id, tick, actionType })
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
