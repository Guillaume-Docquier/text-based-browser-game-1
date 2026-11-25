import { PlayerViewSchema } from "#api/gameplay/PlayerView.ts"
import { TurnStateSchema } from "#api/gameplay/TurnState.ts"
import { UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"
import { GetPlayerViewErrorResponses } from "./getPlayerView.error.ts"
import { GetPlayerViewQuerySchema } from "./getPlayerView.query.ts"
import type { GetPlayerViewUseCase } from "./getPlayerView.useCase.ts"
import { GetTurnStateErrorResponses } from "./getTurnState.error.ts"
import { GetTurnStateQuerySchema } from "./getTurnState.query.ts"
import type { GetTurnStateUseCase } from "./getTurnState.useCase.ts"
import { UpdateReadinessCommandSchema } from "./updateReadiness.command.ts"
import type { UpdateReadinessUseCase } from "./updateReadiness.useCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({
  trpc,
  getPlayerViewUseCase,
  getTurnStateUseCase,
  updateReadinessUseCase,
}: {
  trpc: Trpc
  getPlayerViewUseCase: GetPlayerViewUseCase
  getTurnStateUseCase: GetTurnStateUseCase
  updateReadinessUseCase: UpdateReadinessUseCase
}) {
  return trpc.router({
    updateReadiness: trpc.inGameProcedure
      .input(UpdateReadinessCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(updateReadinessUseCase.execute(input, { playerId }), UpdateReadinessErrorResponses),
      ),

    turnState: trpc.inGameProcedure
      .input(GetTurnStateQuerySchema)
      .output(TurnStateSchema)
      .query(async ({ input }) => await toTrpcOutput(getTurnStateUseCase.execute(input), GetTurnStateErrorResponses)),

    getPlayerView: trpc.inGameProcedure
      .input(GetPlayerViewQuerySchema)
      .output(PlayerViewSchema)
      .query(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(getPlayerViewUseCase.execute(input, { playerId }), GetPlayerViewErrorResponses),
      ),
  })
}
