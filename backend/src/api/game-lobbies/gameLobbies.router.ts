import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import type { Trpc } from "#api/trpc.ts"
import {
  CreatedLobbyDto,
  CreateLobbyDto,
  type GameLobbiesController,
  LobbyDto,
  JoinedLobbyDto,
  JoinLobbyDto,
  LeaveLobbyDto,
  LeftLobbyDto,
} from "./gameLobbies.controller.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameLobbiesRouter({
  trpc,
  gameLobbiesController,
  ...others
}: {
  trpc: Trpc
  gameLobbiesController: GameLobbiesController
  logger: Logger
}) {
  const gameLobbiesRouterLogger = others.logger.child({ scope: "game-lobbies-router" })

  return trpc.router({
    create: trpc.privateProcedure
      .input(CreateLobbyDto.omit({ createdByAccountId: true }))
      .output(CreatedLobbyDto)
      .mutation(async ({ input: newGame, ctx: { account } }) => {
        const createResult = await gameLobbiesController.createLobby({ ...newGame, createdByAccountId: account.id })
        if (Result.isFailure(createResult)) {
          gameLobbiesRouterLogger.error("Could not create game.", { newGame, playerId: account.id, error: createResult.error })
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game could not be created.",
          })
        }

        return createResult.value
      }),

    getById: trpc.publicProcedure
      .input(z.object({ gameId: z.coerce.number() }))
      .output(LobbyDto)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const game = await gameLobbiesController.getLobbyById({ gameId, playerId: account?.id })
        gameLobbiesRouterLogger.info(`GET game ${gameId}`, { game })

        if (game === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game exists with id ${gameId}`,
          })
        }

        return game
      }),

    join: trpc.privateProcedure
      .input(JoinLobbyDto.pick({ gameId: true }))
      .output(JoinedLobbyDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const joinGameResult = await gameLobbiesController.joinLobby({ gameId, accountId: account.id })
        if (Result.isFailure(joinGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: joinGameResult.error,
          })
        }

        return joinGameResult.value
      }),

    leave: trpc.privateProcedure
      .input(LeaveLobbyDto.pick({ gameId: true }))
      .output(LeftLobbyDto)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const leaveGameResult = await gameLobbiesController.leaveLobby({ gameId, accountId: account.id })
        if (Result.isFailure(leaveGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: leaveGameResult.error,
          })
        }

        return leaveGameResult.value
      }),
  })
}
