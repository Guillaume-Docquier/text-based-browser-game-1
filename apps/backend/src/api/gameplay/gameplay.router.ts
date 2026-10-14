import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { UpdateReadinessErrorResponses } from "#api/gameplay/updateReadiness.error.ts"
import { NO_OUTPUT, type Trpc } from "#api/trpc.ts"
import { GetPlayerViewErrorResponses } from "./getPlayerView.error.ts"
import { type GetPlayerViewUseCase, PlayerViewDtoSchema } from "./getPlayerView.useCase.ts"
import { UpdateActionSubmissionErrorResponses } from "./updateActionSubmission.error.ts"
import { type UpdateActionSubmissionUseCase, UpdateActionSubmissionDtoSchema } from "./updateActionSubmission.useCase.ts"
import { type UpdateReadinessUseCase, UpdateReadinessDtoSchema } from "./updateReadiness.useCase.ts"

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
      .input(UpdateReadinessDtoSchema.omit({ playerId: true }))
      .output(NO_OUTPUT)
      .mutation(async ({ input, ctx: { playerId } }) => {
        const updateReadinessResult = await updateReadinessUseCase.execute({ ...input, playerId })
        if (Result.isFailure(updateReadinessResult)) {
          throw new TRPCError(UpdateReadinessErrorResponses[updateReadinessResult.error])
        }

        return updateReadinessResult.value
      }),

    /**
     * Returns the requesting player's gameplay view, including the galaxy, resources, Actions, and Turn state.
     * Use to load or refresh the gameplay screen for a game the account has joined.
     */
    getPlayerView: trpc.inGameProcedure.output(PlayerViewDtoSchema).query(async ({ input, ctx: { playerId } }) => {
      const getPlayerViewResult = await getPlayerViewUseCase.execute({ ...input, playerId })
      if (Result.isFailure(getPlayerViewResult)) {
        throw new TRPCError(GetPlayerViewErrorResponses[getPlayerViewResult.error])
      }

      return getPlayerViewResult.value
    }),

    /**
     * Submits or changes one of the requesting player's Actions for the current Turn.
     * Use while the player is not Ready to select targets, or pass null selectedTargets to cancel the submission.
     */
    updateActionSubmission: trpc.inGameProcedure
      .input(UpdateActionSubmissionDtoSchema.omit({ playerId: true }))
      .output(NO_OUTPUT)
      .mutation(async ({ input, ctx: { playerId } }) => {
        const updateActionSubmissionResult = await updateActionSubmissionUseCase.execute({ ...input, playerId })
        if (Result.isFailure(updateActionSubmissionResult)) {
          throw new TRPCError(UpdateActionSubmissionErrorResponses[updateActionSubmissionResult.error])
        }

        return updateActionSubmissionResult.value
      }),
  })
}
