import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { SubmittedActionTargetsDtoSchema } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { GameIdSchema } from "#lib/db/games/GameId.ts"
import { PlayerIdSchema } from "#lib/db/players/PlayerId.ts"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import { validateSubmittedActions } from "#lib/rules-engine/action-submission/validation/validateSubmittedActions.ts"
import { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"
import { safeResolveTargetId } from "#lib/rules-engine/turn-resolution/effects/resolveTargetId.ts"
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

      const actionsById = new Map(Array.from(context.actions, (action) => [action.id, action]))
      const action = actionsById.get(submittedActionTargets.actionId)
      if (action === undefined) {
        throw new TransactionRollbackError("Invalid action id")
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
        throw new TransactionRollbackError("No action definition found", {
          cause: { actionDefinitionId: submittedAction.actionDefinitionId },
        })
      }

      const planetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([tag, targetDefinition]) => {
              if (targetDefinition.targetType !== TargetType.PLANET) {
                return null
              }

              return safeResolveTargetId(submittedAction.selectedTargets, { tag, targetType: targetDefinition.targetType })
            })
            .filter((planetId) => planetId !== null),
        ),
      ]
      const planets = await this.gameplayRepository.getPlanetsByIds({ gameId: context.gameId, planetIds }, tx)

      const fleetIds = [
        ...new Set(
          Object.entries(actionDefinition.targets)
            .map(([tag, targetDefinition]) => {
              if (targetDefinition.targetType !== TargetType.FLEET) {
                return null
              }

              return safeResolveTargetId(submittedAction.selectedTargets, { tag, targetType: targetDefinition.targetType })
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
