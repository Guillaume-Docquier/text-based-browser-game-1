import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { type MapsController, MapDto } from "#api/maps/maps.controller.ts"
import type { Trpc } from "#api/trpc.ts"
import { GameIdSchema } from "#api/games/GameIdSchema.ts"

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createMapsRouter({ trpc, mapsController, ...others }: { trpc: Trpc; mapsController: MapsController; logger: Logger }) {
  const mapsRouterLogger = others.logger.child({ scope: "maps-router" })

  return trpc.router({
    getByGameId: trpc.privateProcedure
      .input(z.object({ gameId: GameIdSchema }))
      .output(z.object({ map: MapDto }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getMapResult = await mapsController.getByGameId({ gameId, playerId: player.id })
        if (Result.isFailure(getMapResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getMapResult.error,
          })
        }

        if (getMapResult.value === undefined) {
          mapsRouterLogger.error("No map found", { gameId, player })
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No map found for game with id ${gameId}`,
          })
        }

        return { map: getMapResult.value }
      }),
  })
}
