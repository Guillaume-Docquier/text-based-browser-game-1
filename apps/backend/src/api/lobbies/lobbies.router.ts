import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"
import type { Trpc } from "#api/trpc.ts"
import { CreatedLobbyDtoSchema, CreateLobbyDtoSchema, type CreateLobbyUseCase } from "./CreateLobbyUseCase.ts"
import { type GetLobbyByIdUseCase, LobbyDtoSchema } from "./GetLobbyByIdUseCase.ts"
import { type GetLobbyCreationSettingsUseCase, LobbyCreationSettingsDtoSchema } from "./GetLobbyCreationSettingsUseCase.ts"
import { JoinLobbyDtoSchema, type JoinLobbyUseCase } from "./JoinLobbyUseCase.ts"
import { LeaveLobbyDtoSchema, type LeaveLobbyUseCase } from "./LeaveLobbyUseCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createLobbiesRouter({
  trpc,
  createLobbyUseCase,
  getLobbyByIdUseCase,
  getLobbyCreationSettingsUseCase,
  joinLobbyUseCase,
  leaveLobbyUseCase,
  ...others
}: {
  trpc: Trpc
  createLobbyUseCase: CreateLobbyUseCase
  getLobbyByIdUseCase: GetLobbyByIdUseCase
  getLobbyCreationSettingsUseCase: GetLobbyCreationSettingsUseCase
  joinLobbyUseCase: JoinLobbyUseCase
  leaveLobbyUseCase: LeaveLobbyUseCase
  logger: Logger
}) {
  const lobbiesRouterLogger = others.logger.child({ scope: "lobbies-router" })

  return trpc.router({
    getCreationSettings: trpc.privateProcedure.output(LobbyCreationSettingsDtoSchema).query(async () => {
      const creationSettingsResult = await getLobbyCreationSettingsUseCase.execute()
      if (Result.isFailure(creationSettingsResult)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Game creation settings could not be loaded.",
        })
      }

      return creationSettingsResult.value
    }),

    create: trpc.privateProcedure
      .input(CreateLobbyDtoSchema.omit({ createdByAccountId: true }))
      .output(CreatedLobbyDtoSchema)
      .mutation(async ({ input: newGame, ctx: { account } }) => {
        const createResult = await createLobbyUseCase.execute({ ...newGame, createdByAccountId: account.id })
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
      .input(z.object({ gameId: z.coerce.number().pipe(GameIdSchema) }))
      .output(LobbyDtoSchema)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const game = await getLobbyByIdUseCase.execute({
          gameId,
          playerId: account === undefined ? undefined : branded(account.id),
        })
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
      .input(JoinLobbyDtoSchema.pick({ gameId: true }))
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const joinGameResult = await joinLobbyUseCase.execute({ gameId, accountId: account.id })
        if (Result.isFailure(joinGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: joinGameResult.error,
          })
        }
      }),

    leave: trpc.privateProcedure
      .input(LeaveLobbyDtoSchema.pick({ gameId: true }))
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const leaveGameResult = await leaveLobbyUseCase.execute({ gameId, accountId: account.id })
        if (Result.isFailure(leaveGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: leaveGameResult.error,
          })
        }
      }),
  })
}
