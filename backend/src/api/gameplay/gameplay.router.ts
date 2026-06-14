import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { GameId } from "#api/shared/GameId.ts"
import type { Trpc } from "#api/trpc.ts"
import {
  CurrentActionDto,
  GetCurrentActionDto,
  GetPlayerViewDto,
  PlayerViewDto,
  type GameplayController,
  SetCurrentActionDto,
  StartedGameDto,
} from "./gameplay.controller.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({ trpc, gameplayController }: { trpc: Trpc; gameplayController: GameplayController }) {
  return trpc.router({
    startGame: trpc.privateProcedure
      .input(z.object({ gameId: GameId }))
      .output(StartedGameDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const startResult = await gameplayController.startGame({ gameId, playerId: account.id })
        if (Result.isFailure(startResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: startResult.error,
          })
        }

        return startResult.value
      }),

    getPlayerView: trpc.privateProcedure
      .input(GetPlayerViewDto.pick({ gameId: true }))
      .output(PlayerViewDto)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getByIdResult = await gameplayController.getPlayerView({ gameId, playerId: account.id })
        if (Result.isFailure(getByIdResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getByIdResult.error,
          })
        }

        if (getByIdResult.value === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No view exists for this player and this game",
          })
        }

        return getByIdResult.value
      }),

    getCurrentAction: trpc.privateProcedure
      .input(GetCurrentActionDto.pick({ gameId: true }))
      .output(CurrentActionDto)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getCurrentActionResult = await gameplayController.getCurrentAction({ gameId, playerId: account.id })
        if (Result.isFailure(getCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getCurrentActionResult.error,
          })
        }

        return { action: getCurrentActionResult.value }
      }),

    setCurrentAction: trpc.privateProcedure
      .input(SetCurrentActionDto.omit({ playerId: true }))
      .output(CurrentActionDto)
      .mutation(async ({ input: { gameId, tick, actionType }, ctx: { account } }) => {
        const setCurrentActionResult = await gameplayController.setCurrentAction({
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
