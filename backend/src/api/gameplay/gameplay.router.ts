import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import type { Trpc } from "#api/trpc.ts"
import { GameId } from "#lib/db/games/GameId.ts"
import { PlayerId } from "#lib/db/players/PlayerId.ts"
import { PlayerViewDto, type GameplayController, UpdateActionSubmissionDto, StartedGameDto } from "./gameplay.controller.ts"
import { playerInGame } from "./PlayerInGame.ts"

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
    .input(z.object({ gameId: GameId }))
    .use(async ({ input: { gameId }, ctx: { account }, next }) => {
      const playerId = PlayerId.parse(account.id)
      const hasPlayerJoinedGameResult = await gameplayController.hasPlayerJoinedGame({ gameId, playerId })
      if (Result.isFailure(hasPlayerJoinedGameResult)) {
        logger.error("Failed to determine if player has joined the game.", {
          gameId,
          accountId: account.id,
          error: hasPlayerJoinedGameResult.error,
        })
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to participate in this game.",
        })
      }

      if (!hasPlayerJoinedGameResult.value) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must join a game before you can participate in it.",
        })
      }

      return await next({ ctx: { playerInGame: playerInGame(gameId, playerId) } })
    })

  return trpc.router({
    startGame: inGameProcedure.output(StartedGameDto).mutation(async ({ input, ctx: { account } }) => {
      const startResult = await gameplayController.startGame({ ...input, requesterAccountId: account.id })
      if (Result.isFailure(startResult)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: startResult.error,
        })
      }

      return startResult.value
    }),

    getPlayerView: inGameProcedure.output(PlayerViewDto).query(async ({ input, ctx: { playerInGame } }) => {
      const getByIdResult = await gameplayController.getPlayerView({ ...input, playerId: playerInGame.playerId })
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

    updateActionSubmission: inGameProcedure
      .input(UpdateActionSubmissionDto.omit({ playerId: true }))
      .mutation(async ({ input, ctx: { playerInGame } }) => {
        const setCurrentActionResult = await gameplayController.updateActionSubmission({ ...input, playerId: playerInGame.playerId })
        if (Result.isFailure(setCurrentActionResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: setCurrentActionResult.error,
          })
        }
      }),
  })
}
