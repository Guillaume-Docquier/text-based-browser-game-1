import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { type StarSystemsController, StarSystemReadModel } from "#api/star-systems/starSystems.controller.ts"
import type { Trpc } from "#api/trpc.ts"

const GameId = z.coerce.number().int().positive()

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
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
      .output(z.object({ starSystem: StarSystemReadModel }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getStarSystemResult = await starSystemsController.getByGameId({ gameId, playerId: player.id })
        if (Result.isFailure(getStarSystemResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getStarSystemResult.error,
          })
        }

        if (getStarSystemResult.value === undefined) {
          starSystemsRouterLogger.error("No star system found", { gameId, player })
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No star system found for game with id ${gameId}`,
          })
        }

        return { starSystem: getStarSystemResult.value }
      }),
  })
}
