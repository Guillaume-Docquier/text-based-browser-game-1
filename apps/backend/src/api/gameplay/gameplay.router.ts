import { PlayerViewSchema } from "#api/gameplay/PlayerView.ts"
import { UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"
import { GetPlayerViewErrorResponses } from "./getPlayerView.error.ts"
import { GetPlayerViewQuerySchema } from "./getPlayerView.query.ts"
import type { GetPlayerViewUseCase } from "./getPlayerView.useCase.ts"
import { UpdateActionSubmissionCommandSchema } from "./updateActionSubmission.command.ts"
import { UpdateActionSubmissionErrorResponses } from "./updateActionSubmission.error.ts"
import type { UpdateActionSubmissionUseCase } from "./updateActionSubmission.useCase.ts"
import { UpdateReadinessCommandSchema } from "./updateReadiness.command.ts"
import type { UpdateReadinessUseCase } from "./updateReadiness.useCase.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createGameplayRouter({
  trpc,
  getPlayerViewUseCase,
  updateActionSubmissionUseCase,
  updateReadinessUseCase,
}: {
  trpc: Trpc
  getPlayerViewUseCase: GetPlayerViewUseCase
  updateActionSubmissionUseCase: UpdateActionSubmissionUseCase
  updateReadinessUseCase: UpdateReadinessUseCase
}) {
  return trpc.router({
    /**
     * Sets the requesting player's Readiness and closes the Turn early when all players are Ready.
     * Use to lock in Actions or cancel Readiness while the current Turn is still collecting Actions.
     */
    updateReadiness: trpc.inGameProcedure
      .input(UpdateReadinessCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(updateReadinessUseCase.execute(input, { playerId }), UpdateReadinessErrorResponses),
      ),

    /**
     * Returns the requesting player's gameplay view, including the galaxy, resources, Actions, and Turn state.
     * Use to load or refresh the gameplay screen for a game the account has joined.
     */
    getPlayerView: trpc.inGameProcedure
      .input(GetPlayerViewQuerySchema)
      .output(PlayerViewSchema)
      .query(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(getPlayerViewUseCase.execute(input, { playerId }), GetPlayerViewErrorResponses),
      ),

    /**
     * Submits or changes one of the requesting player's Actions for the current Turn.
     * Use while the player is not Ready to select targets, or pass null selectedTargets to cancel the submission.
     */
    updateActionSubmission: trpc.inGameProcedure
      .input(UpdateActionSubmissionCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input, ctx: { playerId } }) =>
          await toTrpcOutput(updateActionSubmissionUseCase.execute(input, { playerId }), UpdateActionSubmissionErrorResponses),
      ),
  })
}
