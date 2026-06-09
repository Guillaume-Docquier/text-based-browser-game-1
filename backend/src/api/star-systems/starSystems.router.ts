import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { GameId } from "#api/games/GameId.ts"
import { type StarSystemsController, StarSystemDto } from "#api/star-systems/starSystems.controller.ts"
import type { Trpc } from "#api/trpc.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createStarSystemsRouter({
  trpc,
  starSystemsController,
  ...others
}: {
  trpc: Trpc
  starSystemsController: StarSystemsController
  logger: Logger
}) {
  const starSystemsRouterLogger = others.logger.child({ scope: "star-systems-router" })

  return trpc.router({
    getByGameId: trpc.privateProcedure
      .input(z.object({ gameId: GameId }))
      .output(z.object({ starSystem: StarSystemDto }))
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getStarSystemResult = await starSystemsController.getByGameId({ gameId, accountId: account.id })
        if (Result.isFailure(getStarSystemResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getStarSystemResult.error,
          })
        }

        if (getStarSystemResult.value === undefined) {
          starSystemsRouterLogger.error("No star system found", { gameId, account })
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No star system found for game with id ${gameId}`,
          })
        }

        return { starSystem: getStarSystemResult.value }
      }),
  })
}
