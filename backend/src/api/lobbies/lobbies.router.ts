import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import z from "zod"
import type { Trpc } from "#api/trpc.ts"
import {
  CreatedLobbyDto,
  CreateLobbyDto,
  type LobbiesController,
  LobbyDto,
  JoinedLobbyDto,
  JoinLobbyDto,
  LeaveLobbyDto,
  LeftLobbyDto,
} from "./lobbies.controller.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createLobbiesRouter({
  trpc,
  lobbiesController,
  ...others
}: {
  trpc: Trpc
  lobbiesController: LobbiesController
  logger: Logger
}) {
  const lobbiesRouterLogger = others.logger.child({ scope: "lobbies-router" })

  return trpc.router({
    create: trpc.privateProcedure
      .input(CreateLobbyDto.omit({ createdByAccountId: true }))
      .output(CreatedLobbyDto)
      .mutation(async ({ input: newGame, ctx: { account } }) => {
        const createResult = await lobbiesController.createLobby({ ...newGame, createdByAccountId: account.id })
        if (Result.isFailure(createResult)) {
          lobbiesRouterLogger.error("Could not create game.", { newGame, playerId: account.id, error: createResult.error })
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
        const game = await lobbiesController.getLobbyById({ gameId, playerId: account?.id })
        lobbiesRouterLogger.info(`GET game ${gameId}`, { game })

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
        const joinGameResult = await lobbiesController.joinLobby({ gameId, accountId: account.id })
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
        const leaveGameResult = await lobbiesController.leaveLobby({ gameId, accountId: account.id })
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
