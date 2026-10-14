import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { UpdateReadinessError } from "#api/gameplay/updateReadiness.error.ts"
import { NO_OUTPUT, type Trpc } from "#api/trpc.ts"
import { GetPlayerViewError } from "./getPlayerView.error.ts"
import { type GetPlayerViewUseCase, PlayerViewDtoSchema } from "./getPlayerView.useCase.ts"
import { UpdateActionSubmissionError } from "./updateActionSubmission.error.ts"
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
        if (Result.isSuccess(updateReadinessResult)) {
          return
        }

        switch (updateReadinessResult.error) {
          case UpdateReadinessError.TURN_NOT_OPEN:
            throw new TRPCError({ code: "CONFLICT", message: "Readiness cannot be changed: the turn is not open." })
          case UpdateReadinessError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Readiness could not be updated." })
          default:
            Assert.isExhausted(updateReadinessResult.error)
        }
      }),

    /**
     * Returns the requesting player's gameplay view, including the galaxy, resources, Actions, and Turn state.
     * Use to load or refresh the gameplay screen for a game the account has joined.
     */
    getPlayerView: trpc.inGameProcedure.output(PlayerViewDtoSchema).query(async ({ input, ctx: { playerId } }) => {
      const getPlayerViewResult = await getPlayerViewUseCase.execute({ ...input, playerId })
      if (Result.isSuccess(getPlayerViewResult)) {
        return getPlayerViewResult.value
      }

      switch (getPlayerViewResult.error) {
        case GetPlayerViewError.VIEW_NOT_FOUND:
          throw new TRPCError({ code: "NOT_FOUND", message: "No view exists." })
        case GetPlayerViewError.UNKNOWN:
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Player view could not be loaded." })
      }
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
        if (Result.isSuccess(updateActionSubmissionResult)) {
          return
        }

        switch (updateActionSubmissionResult.error) {
          case UpdateActionSubmissionError.TURN_NOT_OPEN:
            throw new TRPCError({ code: "CONFLICT", message: "Actions cannot be changed: the turn is not open." })
          case UpdateActionSubmissionError.PLAYER_READY:
            throw new TRPCError({ code: "CONFLICT", message: "You must cancel readiness before changing actions." })
          case UpdateActionSubmissionError.INVALID_ACTION_ID:
            throw new TRPCError({ code: "BAD_REQUEST", message: "This action is not available." })
          case UpdateActionSubmissionError.ACTION_DEFINITION_NOT_FOUND:
            throw new TRPCError({ code: "BAD_REQUEST", message: "Could not find a definition for this action." })
          case UpdateActionSubmissionError.INVALID_SUBMISSION:
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid action submission, targets are invalid or costs cannot be paid." })
          case UpdateActionSubmissionError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Action submission could not be updated." })
          default:
            Assert.isExhausted(updateActionSubmissionResult.error)
        }
      }),
  })
}
