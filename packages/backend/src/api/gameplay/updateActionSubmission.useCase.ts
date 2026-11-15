import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { validateSubmittedActions } from "shared/action-submission/validation/validateSubmittedActions.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { safeResolveTargetId } from "shared/turn-resolution/effects/resolveTargetId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { UpdateActionSubmissionCommand } from "./updateActionSubmission.command.ts"
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
  public async execute(
    { gameId, turn, submittedActionTargets }: UpdateActionSubmissionCommand,
    { playerId }: { playerId: PlayerId },
  ): Promise<Result<void, UpdateActionSubmissionError>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getActionSubmissionsForUpdate({ gameId, playerId, turn }, tx)

      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.INVALID_ACTION_ID)
      }

      const actionDefinition = context.ruleset.actionDefinitions[action.actionDefinitionId]
      if (actionDefinition === undefined) {
        throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.ACTION_DEFINITION_NOT_FOUND)
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
        this.logger.error("Invalid action submission", { issues })
        throw new UpdateActionSubmissionRollbackError(UpdateActionSubmissionError.INVALID_SUBMISSION)
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

      if (setActionResult.error instanceof UpdateActionSubmissionRollbackError) {
        return Result.Failure(setActionResult.error.code)
      }

      return Result.Failure(UpdateActionSubmissionError.UNKNOWN)
    }

    return Result.Success(undefined)
  }
}
