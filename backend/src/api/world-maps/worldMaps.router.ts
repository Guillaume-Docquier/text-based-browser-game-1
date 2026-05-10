import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import { WorldMapsControllerFailure, type WorldMapsController } from "#api/world-maps/worldMaps.controller.ts"
import type { Trpc } from "#api/trpc.ts"
import { WorldMapBodyDetails, WorldMapSectorDetails, WorldMapSystem } from "#lib/db/worldMaps.repository.ts"

const GameId = z.coerce.number().int().positive()
const RowId = z.coerce.number().int().positive()
const SectorCoordinate = z.string().regex(/^\d{2}:\d{2}$/)
const BodyCoordinate = z.string().regex(/^\d{2}:\d{2}:\d{2}$/)

const SectorInput = z.union([
  z.object({ gameId: GameId, sectorId: RowId }).strict(),
  z.object({ gameId: GameId, coordinate: SectorCoordinate }).strict(),
])

const BodyInput = z.union([
  z.object({ gameId: GameId, bodyId: RowId }).strict(),
  z.object({ gameId: GameId, coordinate: BodyCoordinate }).strict(),
])

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createWorldMapsRouter({ trpc, worldMapsController }: { trpc: Trpc; worldMapsController: WorldMapsController }) {
  return trpc.router({
    getSystem: trpc.privateProcedure
      .input(z.object({ gameId: GameId }))
      .output(z.object({ system: WorldMapSystem }))
      .query(async ({ input: { gameId }, ctx: { player } }) => {
        const getSystemResult = await worldMapsController.getSystem({ gameId, playerId: player.id })
        if (Result.isFailure(getSystemResult)) {
          throw toTrpcError(getSystemResult.error)
        }

        return { system: getSystemResult.value }
      }),

    getSector: trpc.privateProcedure
      .input(SectorInput)
      .output(z.object({ sector: WorldMapSectorDetails }))
      .query(async ({ input, ctx: { player } }) => {
        const selector = "sectorId" in input ? { sectorId: input.sectorId } : { coordinate: input.coordinate }
        const getSectorResult = await worldMapsController.getSector({ gameId: input.gameId, playerId: player.id, selector })
        if (Result.isFailure(getSectorResult)) {
          throw toTrpcError(getSectorResult.error)
        }

        return { sector: getSectorResult.value }
      }),

    getBody: trpc.privateProcedure
      .input(BodyInput)
      .output(z.object({ body: WorldMapBodyDetails }))
      .query(async ({ input, ctx: { player } }) => {
        const selector = "bodyId" in input ? { bodyId: input.bodyId } : { coordinate: input.coordinate }
        const getBodyResult = await worldMapsController.getBody({ gameId: input.gameId, playerId: player.id, selector })
        if (Result.isFailure(getBodyResult)) {
          throw toTrpcError(getBodyResult.error)
        }

        return { body: getBodyResult.value }
      }),
  })
}

function toTrpcError(error: string): TRPCError {
  const notFoundFailures: string[] = [
    WorldMapsControllerFailure.GAME_NOT_FOUND,
    WorldMapsControllerFailure.WORLD_MAP_NOT_FOUND,
    WorldMapsControllerFailure.SECTOR_NOT_FOUND,
    WorldMapsControllerFailure.BODY_NOT_FOUND,
  ]

  return new TRPCError({
    code: notFoundFailures.includes(error) ? "NOT_FOUND" : "BAD_REQUEST",
    message: error,
  })
}
