import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { type WorldMapsController, WorldMapSystemReadModel } from "#api/world-maps/worldMaps.controller.ts"
import type { Trpc } from "#api/trpc.ts"

const GameId = z.coerce.number().int().positive()

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createWorldMapsRouter({ trpc, worldMapsController }: { trpc: Trpc; worldMapsController: WorldMapsController }) {
  return trpc.router({
    getStarSystem: trpc.privateProcedure
      .input(z.object({ gameId: GameId }))
      .output(z.object({ system: WorldMapSystemReadModel }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getStarSystemResult = await worldMapsController.getStarSystem({ gameId, playerId: player.id })
        if (Result.isFailure(getStarSystemResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getStarSystemResult.error,
          })
        }

        return { system: getStarSystemResult.value }
      }),
  })
}
