import type { Logger } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { GameCreationConfirmationSchema } from "#api/games/GameCreationConfirmation.ts"
import { GameCreationSettingsSchema } from "#api/games/gameCreationSettings.ts"
import { NO_INPUT, NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"
import { CreateGameCommandSchema } from "./createGame.command.ts"
import { CreateGameErrorResponses } from "./createGame.error.ts"
import type { CreateGameUseCase } from "./createGame.useCase.ts"
import { GameDetailsSchema } from "./GameDetails.ts"
import { GameListingSchema } from "./GameListing.ts"
import { GetGameByIdErrorResponses } from "./getGameById.error.ts"
import { GetGameByIdQuerySchema } from "./getGameById.query.ts"
import { GetGameCreationSettingsErrorResponses } from "./getGameCreationSettings.error.ts"
import type { GetGameCreationSettingsUseCase } from "./getGameCreationSettings.useCase.ts"
import type { GetGameDetailsUseCase } from "./getGameDetailsUseCase.ts"
import { GetGameListingsErrorResponses } from "./getGameListings.error.ts"
import type { GetGameListingsUseCase } from "./getGameListings.useCase.ts"
import { JoinGameCommandSchema } from "./joinGame.command.ts"
import { JoinGameErrorResponses } from "./joinGame.error.ts"
import type { JoinGameUseCase } from "./joinGame.useCase.ts"
import { LeaveGameCommandSchema } from "./leaveGame.command.ts"
import { LeaveGameErrorResponses } from "./leaveGame.error.ts"
import type { LeaveGameUseCase } from "./leaveGame.useCase.ts"
import { StartGameCommandSchema } from "./startGame.command.ts"
import { StartGameErrorResponses } from "./startGame.error.ts"
import type { StartGameUseCase } from "./startGame.useCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGamesRouter({
  trpc,
  getGameListingsUseCase,
  startGameUseCase,
  createGameUseCase,
  getGameDetailsUseCase,
  getGameCreationSettingsUseCase,
  joinGameUseCase,
  leaveGameUseCase,
}: {
  trpc: Trpc
  getGameListingsUseCase: GetGameListingsUseCase
  startGameUseCase: StartGameUseCase
  createGameUseCase: CreateGameUseCase
  getGameDetailsUseCase: GetGameDetailsUseCase
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
      .output(z.array(GameListingSchema))
      .query(
        async ({ ctx: { account } }) =>
          await toTrpcOutput(getGameListingsUseCase.execute({ accountId: account?.id }), GetGameListingsErrorResponses),
      ),

    /**
     * Starts a lobby and initializes its galaxy, player resources, and first Turn.
     * Use when the game creator chooses to start play from the lobby.
     */
    startGame: trpc.inGameProcedure
      .input(StartGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(startGameUseCase.execute(input, { requesterAccountId: account.id }), StartGameErrorResponses),
      ),

    /**
     * Returns the available rulesets and maximum seat count for an authenticated account.
     * Use to populate the game creation form before submitting a new lobby.
     */
    getCreationSettings: trpc.privateProcedure
      .input(NO_INPUT)
      .output(GameCreationSettingsSchema)
      .query(async () => await toTrpcOutput(getGameCreationSettingsUseCase.execute(), GetGameCreationSettingsErrorResponses)),

    /**
     * Creates a lobby with the supplied configuration and joins the authenticated account as its creator.
     * Use when submitting the game creation form; the response contains the new game id.
     */
    create: trpc.privateProcedure
      .input(CreateGameCommandSchema)
      .output(GameCreationConfirmationSchema)
      .mutation(
        async ({ input: newGame, ctx: { account } }) =>
          await toTrpcOutput(createGameUseCase.execute(newGame, { createdByAccountId: account.id }), CreateGameErrorResponses),
      ),

    /**
     * Returns public game details and the operations available to the requesting account.
     * Use to display a game's lobby or details, including for visitors who are not signed in.
     */
    getDetails: trpc.publicProcedure
      .input(GetGameByIdQuerySchema)
      .output(GameDetailsSchema)
      .query(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(getGameDetailsUseCase.execute(input, { accountId: account?.id }), GetGameByIdErrorResponses),
      ),

    /**
     * Joins an available lobby as the authenticated account; repeated joins succeed without changes.
     * Use when the account chooses to participate in a game before it starts.
     */
    join: trpc.privateProcedure
      .input(JoinGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(joinGameUseCase.execute(input, { accountId: account.id }), JoinGameErrorResponses),
      ),

    /**
     * Removes the authenticated account from a lobby and frees its seat.
     * Use to withdraw before the game starts; the game creator cannot leave.
     */
    leave: trpc.privateProcedure
      .input(LeaveGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(leaveGameUseCase.execute(input, { accountId: account.id }), LeaveGameErrorResponses),
      ),
  })
}
