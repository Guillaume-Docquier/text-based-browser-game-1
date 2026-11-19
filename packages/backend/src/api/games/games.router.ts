import type { Logger } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { GameCreationConfirmationSchema } from "#api/games/GameCreationConfirmation.ts"
import { NO_INPUT, NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"
import { CreateGameCommandSchema } from "./createGame.command.ts"
import { CreateGameErrorResponses } from "./createGame.error.ts"
import type { CreateGameUseCase } from "./createGame.useCase.ts"
import { GameDetailsSchema } from "./GameDetails.ts"
import { GameListingSchema } from "./GameListing.ts"
import { GetGameByIdErrorResponses } from "./getGameById.error.ts"
import { GetGameByIdQuerySchema } from "./getGameById.query.ts"
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
  joinGameUseCase,
  leaveGameUseCase,
}: {
  trpc: Trpc
  getGameListingsUseCase: GetGameListingsUseCase
  startGameUseCase: StartGameUseCase
  createGameUseCase: CreateGameUseCase
  getGameDetailsUseCase: GetGameDetailsUseCase
  joinGameUseCase: JoinGameUseCase
  leaveGameUseCase: LeaveGameUseCase
  logger: Logger
}) {
  return trpc.router({
    getListings: trpc.publicProcedure
      .input(NO_INPUT)
      .output(z.array(GameListingSchema))
      .query(
        async ({ ctx: { account } }) =>
          await toTrpcOutput(getGameListingsUseCase.execute({ accountId: account?.id }), GetGameListingsErrorResponses),
      ),

    startGame: trpc.inGameProcedure
      .input(StartGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(startGameUseCase.execute(input, { requesterAccountId: account.id }), StartGameErrorResponses),
      ),

    create: trpc.privateProcedure
      .input(CreateGameCommandSchema)
      .output(GameCreationConfirmationSchema)
      .mutation(
        async ({ input: newGame, ctx: { account } }) =>
          await toTrpcOutput(createGameUseCase.execute(newGame, { createdByAccountId: account.id }), CreateGameErrorResponses),
      ),

    getDetails: trpc.publicProcedure
      .input(GetGameByIdQuerySchema)
      .output(GameDetailsSchema)
      .query(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(getGameDetailsUseCase.execute(input, { accountId: account?.id }), GetGameByIdErrorResponses),
      ),

    join: trpc.privateProcedure
      .input(JoinGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(joinGameUseCase.execute(input, { accountId: account.id }), JoinGameErrorResponses),
      ),

    leave: trpc.privateProcedure
      .input(LeaveGameCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { account } }) =>
          await toTrpcOutput(leaveGameUseCase.execute(input, { accountId: account.id }), LeaveGameErrorResponses),
      ),
  })
}
