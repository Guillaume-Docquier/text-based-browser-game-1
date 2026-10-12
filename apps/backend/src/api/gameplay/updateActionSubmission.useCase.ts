import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "shared/action-submission/validation/validateSubmittedActions.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { safeResolveTargetId } from "shared/turn-resolution/effects/resolveTargetId.ts"
import { z } from "zod"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import {
  UpdateActionSubmissionError,
  UpdateActionSubmissionRollbackError,
  type UpdateActionSubmissionFailure,
} from "./updateActionSubmission.error.ts"

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
  }: UpdateActionSubmissionDto): Promise<Result<void, UpdateActionSubmissionFailure>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)

      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new UpdateActionSubmissionRollbackError({ type: UpdateActionSubmissionError.INVALID_ACTION_ID })
      }

      if (submittedActionTargets.selectedTargets === null) {
        await this.gameplayRepository.updateActionSubmissions(
          { context, actions: [{ id: submittedActionTargets.actionId, selectedTargets: null }] },
          tx,
        )
        return
      }

      const submittedAction = {
        id: submittedActionTargets.actionId,
        actionDefinitionId: action.actionDefinitionId,
        playerId,
        selectedTargets: submittedActionTargets.selectedTargets,
      } satisfies SubmittedAction

      const actionDefinition = context.ruleset.actionDefinitions[submittedAction.actionDefinitionId]
      if (actionDefinition === undefined) {
        throw new UpdateActionSubmissionRollbackError({ type: UpdateActionSubmissionError.UNKNOWN })
      }

      const planetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([actionTargetTag, targetDefinition]) => {
              if (targetDefinition.targetType !== TargetType.PLANET) {
                return null
              }

              // Object.entries widens TargetTag to string
              return safeResolveTargetId(submittedAction.selectedTargets, {
                actionTargetTag: branded(actionTargetTag),
                targetType: targetDefinition.targetType,
              })
            })
            .filter((planetId) => planetId !== null),
        ),
      ]
      const planets = await this.gameplayRepository.getPlanetsByIds({ gameId: context.gameId, planetIds }, tx)

      const fleetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([actionTargetTag, targetDefinition]) => {
              if (targetDefinition.targetType !== TargetType.FLEET) {
                return null
              }

              // Object.entries widens TargetTag to string
              return safeResolveTargetId(submittedAction.selectedTargets, {
                actionTargetTag: branded(actionTargetTag),
                targetType: targetDefinition.targetType,
              })
            })
            .filter((fleetId) => fleetId !== null),
        ),
      ]
      const fleets = await this.gameplayRepository.getFleetsByIds({ gameId: context.gameId, fleetIds }, tx)

      const turnState = createTurnState({
        gameId: context.gameId,
        turn,
        playerId,
        resources: context.resources,
        submittedActions: [submittedAction],
        planets,
        fleets,
      })
      const issues = validateSubmittedActions(turnState.submittedActions, context.ruleset, turnState)
      if (issues.length > 0) {
        if (issues.some(({ issue }) => issue.type === "ACTION_DEFINITION_NOT_FOUND" || issue.type === "INVALID_TARGET_CONSTRAINT")) {
          throw new UpdateActionSubmissionRollbackError({ type: UpdateActionSubmissionError.UNKNOWN })
        }
        const type = issues.some(({ issue }) => issue.type !== "INSUFFICIENT_RESOURCE")
          ? UpdateActionSubmissionError.INVALID_TARGETS
          : UpdateActionSubmissionError.INSUFFICIENT_RESOURCES
        throw new UpdateActionSubmissionRollbackError({ type, issues })
      }

      await this.gameplayRepository.updateActionSubmissions({ context, actions: [submittedAction] }, tx)
    })

    if (Result.isFailure(setActionResult)) {
      if (
        setActionResult.error instanceof UpdateActionSubmissionRollbackError &&
        setActionResult.error.failure.type !== UpdateActionSubmissionError.UNKNOWN
      ) {
        return Result.Failure(setActionResult.error.failure)
      }

      this.logger.error("Failed to set current action", {
        gameId,
        turn,
        playerId,
        actionId: submittedActionTargets.actionId,
        error: setActionResult.error,
      })
      return Result.Failure({ type: UpdateActionSubmissionError.UNKNOWN })
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
