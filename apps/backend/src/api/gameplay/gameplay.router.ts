import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { NO_OUTPUT, type Trpc } from "#api/trpc.ts"
import { type GetPlayerViewUseCase, PlayerViewDtoSchema } from "./getPlayerView.useCase.ts"
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
        const result = await updateReadinessUseCase.execute({ ...input, playerId })
        if (Result.isFailure(result)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error })
        }
      }),

    /**
     * Returns the requesting player's gameplay view, including the galaxy, resources, Actions, and Turn state.
     * Use to load or refresh the gameplay screen for a game the account has joined.
     */
    getPlayerView: trpc.inGameProcedure.output(PlayerViewDtoSchema).query(async ({ input, ctx: { playerId } }) => {
      const getPlayerViewResult = await getPlayerViewUseCase.execute({ ...input, playerId })
      if (Result.isFailure(getPlayerViewResult)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getPlayerViewResult.error,
        })
      }

      if (getPlayerViewResult.value === undefined) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No view exists for this player and this game",
        })
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: updateActionSubmissionResult.error,
          })
        }
      }),
  })
}
