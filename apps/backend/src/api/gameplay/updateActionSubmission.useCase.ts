import { type Logger, Result, indexBy } from "@guillaume-docquier/tools-ts"
import { replaceActionSubmission, isActionOccupied } from "shared/action-submission/actionEligibility.ts"
import { validateSubmittedActions } from "shared/action-submission/validation/validateSubmittedActions.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { z } from "zod"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"

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
  public async execute({ gameId, playerId, turn, submittedActionTargets }: UpdateActionSubmissionDto): Promise<Result<void, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)

      if (isActionOccupied({ fleets: indexBy("id", context.fleets) }, { playerId, id: submittedActionTargets.actionId }))
        throw new TransactionRollbackError("Action is in progress and cannot be changed")
      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new TransactionRollbackError("Invalid action id")
      }

      if (submittedActionTargets.selectedTargets === null) {
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

      const turnState = createTurnState({
        gameId: context.gameId,
        turn,
        playerId,
        resources: context.resources,
        submittedActions: replaceActionSubmission(
          context.actions.filter((action): action is SubmittedAction => action.selectedTargets !== null),
          submittedAction,
          submittedAction,
        ),
        planets: [...context.planets],
        fleets: [...context.fleets],
      })
      const issues = validateSubmittedActions(turnState.submittedActions, context.ruleset, turnState)
      if (issues.length > 0) {
        throw new TransactionRollbackError(issues.map(({ issue }) => issue).join("\n"))
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
      return Result.Failure(setActionResult.error.message)
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
