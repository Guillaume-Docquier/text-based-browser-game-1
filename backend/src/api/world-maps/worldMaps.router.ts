import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import {
  WorldMapBodyDetailsReadModel,
  type WorldMapsController,
  WorldMapSectorDetailsReadModel,
  WorldMapSystemReadModel,
} from "#api/world-maps/worldMaps.controller.ts"
import type { Trpc } from "#api/trpc.ts"

const GameId = z.coerce.number().int().positive()
const RowId = z.coerce.number().int().positive()
const BodyCoordinate = z.string().regex(/^\d{2}:\d{2}:\d{2}$/)

const SectorInput = z.object({ gameId: GameId, sectorId: RowId }).strict()

const BodyInput = z.union([
  z.object({ gameId: GameId, bodyId: RowId }).strict(),
  z.object({ gameId: GameId, coordinate: BodyCoordinate }).strict(),
])

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createWorldMapsRouter({ trpc, worldMapsController }: { trpc: Trpc; worldMapsController: WorldMapsController }) {
  return trpc.router({
    getSystem: trpc.privateProcedure
      .input(z.object({ gameId: GameId }))
      .output(z.object({ system: WorldMapSystemReadModel }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getSystemResult = await worldMapsController.getSystem({ gameId, playerId: player.id })
        if (Result.isFailure(getSystemResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getSystemResult.error,
          })
        }

        return { system: getSystemResult.value }
      }),

    getSector: trpc.privateProcedure
      .input(SectorInput)
      .output(z.object({ sector: WorldMapSectorDetailsReadModel }))
      .query(async ({ input: { gameId, sectorId }, ctx: { player } }) => {
        const getSectorResult = await worldMapsController.getSector({ gameId, playerId: player.id, sectorId })
        if (Result.isFailure(getSectorResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getSectorResult.error,
          })
        }

        return { sector: getSectorResult.value }
      }),

    getBody: trpc.privateProcedure
      .input(BodyInput)
      .output(z.object({ body: WorldMapBodyDetailsReadModel }))
      .query(async ({ input, ctx: { player } }) => {
        const selector = "bodyId" in input ? { bodyId: input.bodyId } : { coordinate: input.coordinate }
        const getBodyResult = await worldMapsController.getBody({ gameId: input.gameId, playerId: player.id, selector })
        if (Result.isFailure(getBodyResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getBodyResult.error,
          })
        }

        return { body: getBodyResult.value }
      }),
  })
}
