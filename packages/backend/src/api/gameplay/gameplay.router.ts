import { PlayerViewSchema } from "#api/gameplay/PlayerView.ts"
import { UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"
import { GetPlayerViewErrorResponses } from "./getPlayerView.error.ts"
import { GetPlayerViewQuerySchema } from "./getPlayerView.query.ts"
import type { GetPlayerViewUseCase } from "./getPlayerView.useCase.ts"
import { TurnStateErrorResponses } from "./turnState.error.ts"
import { TurnStateQuerySchema } from "./turnState.query.ts"
import { TurnStateStreamSchema } from "./TurnState.ts"
import type { TurnStateUseCase } from "./turnState.useCase.ts"
import { UpdateReadinessCommandSchema } from "./updateReadiness.command.ts"
import type { UpdateReadinessUseCase } from "./updateReadiness.useCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({
  trpc,
  getPlayerViewUseCase,
  updateReadinessUseCase,
  turnStateUseCase,
}: {
  trpc: Trpc
  getPlayerViewUseCase: GetPlayerViewUseCase
  updateReadinessUseCase: UpdateReadinessUseCase
  turnStateUseCase: TurnStateUseCase
}) {
  return trpc.router({
    turnState: trpc.inGameProcedure
      .input(TurnStateQuerySchema)
      .output(TurnStateStreamSchema)
      .subscription(async function* ({ input, signal }) {
        for await (const snapshot of turnStateUseCase.execute(input, signal)) {
          yield await toTrpcOutput(Promise.resolve(snapshot), TurnStateErrorResponses)
        }
      }),

    updateReadiness: trpc.inGameProcedure
      .input(UpdateReadinessCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(updateReadinessUseCase.execute(input, { playerId }), UpdateReadinessErrorResponses),
      ),

    getPlayerView: trpc.inGameProcedure
      .input(GetPlayerViewQuerySchema)
      .output(PlayerViewSchema)
      .query(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(getPlayerViewUseCase.execute(input, { playerId }), GetPlayerViewErrorResponses),
      ),
  })
}
