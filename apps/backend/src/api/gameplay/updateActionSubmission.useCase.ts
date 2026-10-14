import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { evaluateActionSelection, type EligibilityState } from "shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { z } from "zod"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import { UpdateActionSubmissionError, UpdateActionSubmissionRollbackError } from "./updateActionSubmission.error.ts"

export class UpdateActionSubmissionUseCase {
  private readonly logger: Logger
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    gameplayRepository,
    createTransaction,
  }: {
    logger: Logger
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "update-action-submission-use-case" })
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
  }

  /**
   * Long term we'll probably want a batch submission
   */
  public async execute({
    gameId,
    playerId,
    turn,
    submittedActionTargets,
  }: UpdateActionSubmissionDto): Promise<Result<void, UpdateActionSubmissionError>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      // This locks the current turn row for the full replacement evaluation and write.
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)
      const action = context.actions.find(({ id }) => id === submittedActionTargets.actionId)
      if (action === undefined) {
        throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.INVALID_ACTION_ID)
      }

      const state: EligibilityState = {
        gameId: context.gameId,
        turn,
        submittingPlayerId: playerId,
        resources: context.resources,
        players: Object.fromEntries(context.playerIds.map((id) => [id, { id, ownerPlayerId: id }])),
        planets: Object.fromEntries(context.planets.map((planet) => [planet.id, planet])),
        fleets: Object.fromEntries(context.fleets.map((fleet) => [fleet.id, fleet])),
        actions: context.actions,
      }

      if (submittedActionTargets.selectedTargets === null || submittedActionTargets.selectedInputs === null) {
        const cancellationEvaluation = evaluateActionSelection({
          state,
          ruleset: context.ruleset,
          draft: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
        })
        if (cancellationEvaluation.issues.some(({ code }) => code === "ACTION_ALREADY_IN_PROGRESS")) {
          throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.ACTION_IN_PROGRESS)
        }
        await this.gameplayRepository.updateActionSubmissions(
          { context, actions: [{ id: submittedActionTargets.actionId, selectedTargets: null, selectedInputs: null }] },
          tx,
        )
        return
      }

      const submittedAction = {
        id: submittedActionTargets.actionId,
        actionDefinitionId: action.actionDefinitionId,
        playerId,
        selectedTargets: submittedActionTargets.selectedTargets,
        selectedInputs: submittedActionTargets.selectedInputs,
      } satisfies SubmittedAction
      const actionDefinition = context.ruleset.actionDefinitions[submittedAction.actionDefinitionId]
      if (actionDefinition === undefined) {
        throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.ACTION_DEFINITION_NOT_FOUND)
      }

      const evaluation = evaluateActionSelection({
        state,
        ruleset: context.ruleset,
        draft: {
          actionId: submittedAction.id,
          selectedTargets: submittedAction.selectedTargets,
          selectedInputs: submittedAction.selectedInputs,
        },
      })
      if (evaluation.status !== "ELIGIBLE") {
        this.logger.error("Invalid action submission", { issues: evaluation.issues })
        const code = evaluation.issues.some(({ code }) => code === "ACTION_ALREADY_IN_PROGRESS")
          ? UpdateActionSubmissionError.ACTION_IN_PROGRESS
          : UpdateActionSubmissionError.INVALID_SUBMISSION
        throw new UpdateActionSubmissionRollbackError(code)
      }

      await this.gameplayRepository.updateActionSubmissions({ context, actions: [submittedAction] }, tx)
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", {
        gameId,
        turn,
        playerId,
        actionId: submittedActionTargets.actionId,
        error: setActionResult.error,
      })
      return Result.Failure(
        setActionResult.error instanceof UpdateActionSubmissionRollbackError
          ? setActionResult.error.code
          : UpdateActionSubmissionError.UNKNOWN,
      )
    }

    return Result.Success(undefined)
  }
}

export type UpdateActionSubmissionDto = z.infer<typeof UpdateActionSubmissionDtoSchema>
export const UpdateActionSubmissionDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  playerId: PlayerIdSchema,
  turn: z.coerce.number(),
  submittedActionTargets: SubmittedActionTargetsDtoSchema,
})
