import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { Trpc } from "#api/trpc.ts"
import { GameIdSchema } from "#lib/db/games/GameId.ts"
import {
  PlayerViewDtoSchema,
  type GameplayController,
  UpdateActionSubmissionDtoSchema,
  StartedGameDtoSchema,
  UpdateReadinessDtoSchema,
} from "./gameplay.controller.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({
  trpc,
  gameplayController,
  ...others
}: {
  trpc: Trpc
  logger: Logger
  gameplayController: GameplayController
}) {
  const logger = others.logger.child({ scope: "gameplay-router" })
  const inGameProcedure = trpc.privateProcedure
    .input(z.object({ gameId: GameIdSchema }))
    .use(async ({ input: { gameId }, ctx: { account }, next }) => {
      const playerIdResult = await gameplayController.getPlayerId({ gameId, accountId: account.id })
      if (Result.isFailure(playerIdResult)) {
        logger.error("Failed to determine if player has joined the game.", {
          gameId,
          accountId: account.id,
          error: playerIdResult.error,
        })
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to participate in this game.",
        })
      }

      if (playerIdResult.value === undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must join a game before you can participate in it.",
        })
      }

      return await next({
        ctx: {
          playerId: playerIdResult.value,
        },
      })
    })

  return trpc.router({
    updateReadiness: inGameProcedure
      .input(UpdateReadinessDtoSchema.omit({ playerId: true }))
      .mutation(async ({ input, ctx: { playerId } }) => {
        const result = await gameplayController.updateReadiness({ ...input, playerId })
        if (Result.isFailure(result)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error })
        }
      }),
    startGame: inGameProcedure.output(StartedGameDtoSchema).mutation(async ({ input, ctx: { account } }) => {
      const startResult = await gameplayController.startGame({ ...input, requesterAccountId: account.id })
      if (Result.isFailure(startResult)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: startResult.error,
        })
      }

      return startResult.value
    }),

    getPlayerView: inGameProcedure.output(PlayerViewDtoSchema).query(async ({ input, ctx: { playerId } }) => {
      const getPlayerViewResult = await gameplayController.getPlayerView({ ...input, playerId })
      if (Result.isFailure(getPlayerViewResult)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getPlayerViewResult.error,
        })
      }

      if (getPlayerViewResult.value === undefined) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No view exists for this player and this game",
        })
      }

      return getPlayerViewResult.value
    }),

    updateActionSubmission: inGameProcedure
      .input(UpdateActionSubmissionDtoSchema.omit({ playerId: true }))
      .mutation(async ({ input, ctx: { playerId } }) => {
        const setCurrentActionResult = await gameplayController.updateActionSubmission({ ...input, playerId })
        if (Result.isFailure(setCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: setCurrentActionResult.error,
          })
        }
      }),
  })
}
