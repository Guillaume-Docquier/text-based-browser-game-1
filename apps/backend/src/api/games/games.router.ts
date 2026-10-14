import { Assert, type Logger, Result, branded } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"
import { NO_INPUT, NO_OUTPUT, type Trpc } from "#api/trpc.ts"
import { CreateGameError } from "./createGame.error.ts"
import { CreatedGameDtoSchema, CreateGameDtoSchema, type CreateGameUseCase } from "./createGame.useCase.ts"
import { GameDetailsDtoSchema } from "./GameDetailsDto.ts"
import { GameListingDtoSchema } from "./GameListingDto.ts"
import { GetGameByIdError } from "./getGameById.error.ts"
import type { GetGameByIdUseCase } from "./getGameById.useCase.ts"
import { GetGameCreationSettingsError } from "./getGameCreationSettings.error.ts"
import { type GetGameCreationSettingsUseCase, GameCreationSettingsDtoSchema } from "./getGameCreationSettings.useCase.ts"
import { GetGameListingsError } from "./getGameListings.error.ts"
import type { GetGameListingsUseCase } from "./getGameListings.useCase.ts"
import { JoinGameError } from "./joinGame.error.ts"
import { JoinGameDtoSchema, type JoinGameUseCase } from "./joinGame.useCase.ts"
import { LeaveGameError } from "./leaveGame.error.ts"
import { LeaveGameDtoSchema, type LeaveGameUseCase } from "./leaveGame.useCase.ts"
import { StartGameError } from "./startGame.error.ts"
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
  return trpc.router({
    /**
     * Lists public game overviews, including the requesting account's membership when signed in.
     * Use to browse games or find games the account has joined.
     */
    getListings: trpc.publicProcedure
      .input(NO_INPUT)
      .output(z.array(GameListingDtoSchema))
      .query(async ({ ctx: { account } }) => {
        const result = await getGameListingsUseCase.execute({ accountId: account?.id })
        if (Result.isSuccess(result)) {
          return result.value
        }

        switch (result.error) {
          case GetGameListingsError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game listings could not be loaded." })
        }
      }),

    /**
     * Starts a lobby and initializes its galaxy, player resources, and first Turn.
     * Use when the game creator chooses to start play from the lobby.
     */
    startGame: trpc.inGameProcedure.output(NO_OUTPUT).mutation(async ({ input, ctx: { account } }) => {
      const startGameResult = await startGameUseCase.execute({ ...input, requesterAccountId: account.id })
      if (Result.isSuccess(startGameResult)) {
        return
      }

      switch (startGameResult.error) {
        case StartGameError.GAME_NOT_FOUND:
          throw new TRPCError({ code: "NOT_FOUND", message: "The game does not exist." })
        case StartGameError.NOT_GAME_CREATOR:
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the game creator can start it." })
        case StartGameError.INVALID_GAME_STATUS:
          throw new TRPCError({ code: "CONFLICT", message: "The game cannot start in its current status." })
        case StartGameError.RULESET_NOT_FOUND:
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not find the ruleset." })
        case StartGameError.UNKNOWN:
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game could not be started." })
        default:
          Assert.isExhausted(startGameResult.error)
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
        if (Result.isSuccess(creationSettingsResult)) {
          return creationSettingsResult.value
        }

        switch (creationSettingsResult.error) {
          case GetGameCreationSettingsError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game creation settings could not be loaded." })
        }
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
        if (Result.isSuccess(createResult)) {
          return createResult.value
        }

        switch (createResult.error) {
          case CreateGameError.TOO_MANY_SEATS:
            throw new TRPCError({ code: "BAD_REQUEST", message: "Games cannot have that many seats." })
          case CreateGameError.INVALID_MAP_SEED:
            throw new TRPCError({ code: "BAD_REQUEST", message: "The selected seed is invalid." })
          case CreateGameError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game could not be created." })
        }
      }),

    /**
     * Returns public game details and the operations available to the requesting account.
     * Use to display a game's lobby or details, including for visitors who are not signed in.
     */
    getById: trpc.publicProcedure
      .input(z.object({ gameId: z.coerce.number().pipe(GameIdSchema) }))
      .output(GameDetailsDtoSchema)
      .query(async ({ input: { gameId }, ctx: { account } }) => {
        const getGameResult = await getGameByIdUseCase.execute({
          gameId,
          playerId: account === undefined ? undefined : branded(account.id),
        })
        if (Result.isSuccess(getGameResult)) {
          return getGameResult.value
        }

        switch (getGameResult.error) {
          case GetGameByIdError.GAME_NOT_FOUND:
            throw new TRPCError({ code: "NOT_FOUND", message: "No game exists with that id." })
          case GetGameByIdError.RULESET_NOT_FOUND:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not find the ruleset." })
          case GetGameByIdError.FAILED_TO_GET_PLAYERS:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not get the players." })
          case GetGameByIdError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game details could not be loaded." })
        }
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
        if (Result.isSuccess(joinGameResult)) {
          return
        }

        switch (joinGameResult.error) {
          case JoinGameError.GAME_NOT_FOUND:
            throw new TRPCError({ code: "NOT_FOUND", message: "The game does not exist." })
          case JoinGameError.LOBBY_FULL:
            throw new TRPCError({ code: "CONFLICT", message: "The lobby is full." })
          case JoinGameError.GAME_ALREADY_STARTED:
            throw new TRPCError({ code: "CONFLICT", message: "You cannot join a game that has already started." })
          case JoinGameError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game could not be joined." })
          default:
            Assert.isExhausted(joinGameResult.error)
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
        if (Result.isSuccess(leaveGameResult)) {
          return
        }

        switch (leaveGameResult.error) {
          case LeaveGameError.GAME_NOT_FOUND:
            throw new TRPCError({ code: "NOT_FOUND", message: "The game does not exist." })
          case LeaveGameError.GAME_ALREADY_STARTED:
            throw new TRPCError({ code: "CONFLICT", message: "You cannot leave a game that has already started." })
          case LeaveGameError.CREATOR_CANNOT_LEAVE:
            throw new TRPCError({ code: "FORBIDDEN", message: "The game creator cannot leave the lobby." })
          case LeaveGameError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game could not be left." })
          default:
            Assert.isExhausted(leaveGameResult.error)
        }
      }),
  })
}
