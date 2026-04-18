import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import type { GamePlayerActionsController } from "#api/gamePlayerActions/gamePlayerActions.controller.ts"
import { GamePlayerAction, GamePlayerActionTypeSchema } from "#lib/gamePlayerActions.ts"

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createGamePlayerActionsRouter({
  t,
  privateProcedure,
  gamePlayerActionsController,
}: Trpc & {
  gamePlayerActionsController: GamePlayerActionsController
}) {
  return t.router({
    getCurrentAction: privateProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(z.object({ action: GamePlayerAction.or(z.undefined()) }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getCurrentActionResult = await gamePlayerActionsController.getCurrentAction({ gameId, playerId: player.id })
        if (Result.isFailure(getCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getCurrentActionResult.error,
          })
        }

        return { action: getCurrentActionResult.value }
      }),

    setCurrentAction: privateProcedure
      .input(
        z.object({
          gameId: z.coerce.number(),
          actionType: GamePlayerActionTypeSchema.nullable(),
        }),
      )
      .output(z.object({ action: GamePlayerAction.nullable() }))
      .mutation(async ({ input: { gameId, actionType }, ctx: { player } }) => {
        const setCurrentResult = await gamePlayerActionsController.setCurrentAction({ gameId, playerId: player.id, actionType })
        if (Result.isFailure(setCurrentResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: setCurrentResult.error,
          })
        }

        return { action: setCurrentResult.value ?? null }
      }),
  })
}
