import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"
import { NO_INPUT, NO_OUTPUT, type Trpc } from "#api/trpc.ts"
import { CreatedGameDtoSchema, CreateGameDtoSchema, type CreateGameUseCase } from "./createGame.useCase.ts"
import { GameDetailsDtoSchema } from "./GameDetailsDto.ts"
import { GameListingDtoSchema } from "./GameListingDto.ts"
import type { GetGameByIdUseCase } from "./getGameById.useCase.ts"
import { type GetGameCreationSettingsUseCase, GameCreationSettingsDtoSchema } from "./getGameCreationSettings.useCase.ts"
import type { GetGameListingsUseCase } from "./getGameListings.useCase.ts"
import { JoinGameDtoSchema, type JoinGameUseCase } from "./joinGame.useCase.ts"
import { LeaveGameDtoSchema, type LeaveGameUseCase } from "./leaveGame.useCase.ts"
import type { StartGameUseCase } from "./startGame.useCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGamesRouter({
  trpc,
  getGameListingsUseCase,
  startGameUseCase,
  createGameUseCase,
  getGameByIdUseCase,
  getGameCreationSettingsUseCase,
  joinGameUseCase,
  leaveGameUseCase,
  ...others
}: {
  trpc: Trpc
  getGameListingsUseCase: GetGameListingsUseCase
  startGameUseCase: StartGameUseCase
  createGameUseCase: CreateGameUseCase
  getGameByIdUseCase: GetGameByIdUseCase
  getGameCreationSettingsUseCase: GetGameCreationSettingsUseCase
  joinGameUseCase: JoinGameUseCase
  leaveGameUseCase: LeaveGameUseCase
  logger: Logger
}) {
  const gamesRouterLogger = others.logger.child({ scope: "games-router" })

  return trpc.router({
    /**
     * Lists public game overviews, including the requesting account's membership when signed in.
     * Use to browse games or find games the account has joined.
     */
    getListings: trpc.publicProcedure
      .input(NO_INPUT)
      .output(z.array(GameListingDtoSchema))
      .query(async ({ ctx: { account } }) => {
        return await getGameListingsUseCase.execute({ accountId: account?.id })
      }),

    /**
     * Starts a lobby and initializes its galaxy, player resources, and first Turn.
     * Use when the game creator chooses to start play from the lobby.
     */
    startGame: trpc.inGameProcedure.output(NO_OUTPUT).mutation(async ({ input, ctx: { account } }) => {
      const startResult = await startGameUseCase.execute({ ...input, requesterAccountId: account.id })
      if (Result.isFailure(startResult)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: startResult.error })
      }
    }),

    /**
     * Returns the available rulesets and maximum seat count for an authenticated account.
     * Use to populate the game creation form before submitting a new lobby.
     */
    getCreationSettings: trpc.privateProcedure
      .input(NO_INPUT)
      .output(GameCreationSettingsDtoSchema)
      .query(async () => {
        const creationSettingsResult = await getGameCreationSettingsUseCase.execute()
        if (Result.isFailure(creationSettingsResult)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Game creation settings could not be loaded.",
          })
        }

        return creationSettingsResult.value
      }),

    /**
     * Creates a lobby with the supplied configuration and joins the authenticated account as its creator.
     * Use when submitting the game creation form; the response contains the new game id.
     */
    create: trpc.privateProcedure
      .input(CreateGameDtoSchema.omit({ createdByAccountId: true }))
      .output(CreatedGameDtoSchema)
      .mutation(async ({ input: newGame, ctx: { account } }) => {
        const createResult = await createGameUseCase.execute({ ...newGame, createdByAccountId: account.id })
        if (Result.isFailure(createResult)) {
          gamesRouterLogger.error("Could not create game.", { newGame, playerId: account.id, error: createResult.error })
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Game could not be created.",
          })
        }

        return createResult.value
      }),

    /**
     * Returns public game details and the operations available to the requesting account.
     * Use to display a game's lobby or details, including for visitors who are not signed in.
     */
    getById: trpc.publicProcedure
      .input(z.object({ gameId: z.coerce.number().pipe(GameIdSchema) }))
      .output(GameDetailsDtoSchema)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const game = await getGameByIdUseCase.execute({
          gameId,
          playerId: account === undefined ? undefined : branded(account.id),
        })
        gamesRouterLogger.info(`GET game ${gameId}`, { game })

        if (game === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No game exists with id ${gameId}`,
          })
        }

        return game
      }),

    /**
     * Joins an available lobby as the authenticated account; repeated joins succeed without changes.
     * Use when the account chooses to participate in a game before it starts.
     */
    join: trpc.privateProcedure
      .input(JoinGameDtoSchema.pick({ gameId: true }))
      .output(NO_OUTPUT)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const joinGameResult = await joinGameUseCase.execute({ gameId, accountId: account.id })
        if (Result.isFailure(joinGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: joinGameResult.error,
          })
        }
      }),

    /**
     * Removes the authenticated account from a lobby and frees its seat.
     * Use to withdraw before the game starts; the game creator cannot leave.
     */
    leave: trpc.privateProcedure
      .input(LeaveGameDtoSchema.pick({ gameId: true }))
      .output(NO_OUTPUT)
      .mutation(async ({ input: { gameId }, ctx: { account } }) => {
        const leaveGameResult = await leaveGameUseCase.execute({ gameId, accountId: account.id })
        if (Result.isFailure(leaveGameResult)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: leaveGameResult.error,
          })
        }
      }),
  })
}
