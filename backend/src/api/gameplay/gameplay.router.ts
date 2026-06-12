import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import { LobbyDto } from "../lobbies/lobbies.controller.ts"
import {
  CurrentActionDto,
  GetCurrentActionDto,
  GetGameplayDto,
  GameplayDto,
  type GameplayController,
  SetCurrentActionDto,
  StartGameplayDto,
} from "./gameplay.controller.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({ trpc, gameplayController }: { trpc: Trpc; gameplayController: GameplayController }) {
  return trpc.router({
    start: trpc.privateProcedure
      .input(StartGameplayDto.pick({ gameId: true }))
      .output(LobbyDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const startResult = await gameplayController.start({ gameId, playerId: account.id })
        if (Result.isFailure(startResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: startResult.error,
          })
        }

        return startResult.value
      }),

    getById: trpc.privateProcedure
      .input(GetGameplayDto.pick({ gameId: true }))
      .output(GameplayDto)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getByIdResult = await gameplayController.getById({ gameId, playerId: account.id })
        if (Result.isFailure(getByIdResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getByIdResult.error,
          })
        }

        if (getByIdResult.value === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game state exists with id ${gameId}`,
          })
        }

        return { gameState: getByIdResult.value }
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
