import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamePlayerActionsRepository, GamePlayerActionRow } from "#lib/db/gamePlayerActions.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import { GamePlayerAction, GAME_PLAYER_ACTION_RULES, type GamePlayerActionType } from "#lib/gamePlayerActions.ts"

export class GamePlayerActionsController {
  private readonly gamePlayerActionsRepository: GamePlayerActionsRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gamesRepository: GamesRepository
  private readonly logger: Logger

  public constructor({
    gamePlayerActionsRepository,
    gameStatesRepository,
    gamesRepository,
    logger,
  }: {
    gamePlayerActionsRepository: GamePlayerActionsRepository
    gameStatesRepository: GameStatesRepository
    gamesRepository: GamesRepository
    logger: Logger
  }) {
    this.gamePlayerActionsRepository = gamePlayerActionsRepository
    this.gameStatesRepository = gameStatesRepository
    this.gamesRepository = gamesRepository
    this.logger = logger.child({ scope: "game-player-actions-controller" })
  }

  public async getCurrent({
    gameId,
    playerId,
  }: {
    gameId: number
    playerId: number
  }): Promise<Result<GamePlayerAction | undefined, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    const getCurrentResult = await this.gamePlayerActionsRepository.getByGameIdPlayerIdAndTick({
      gameId,
      playerId,
      tick: activeGameResult.value.tick,
    })
    if (Result.isFailure(getCurrentResult)) {
      this.logger.error("Could not get current game player action", { gameId, playerId, error: getCurrentResult.error })
      return getCurrentResult
    }

    const currentAction = getCurrentResult.value
    return Result.Success(currentAction === undefined ? undefined : toGamePlayerAction(currentAction))
  }

  public async setCurrent({
    gameId,
    playerId,
    actionType,
  }: {
    gameId: number
    playerId: number
    actionType: GamePlayerActionType
  }): Promise<Result<GamePlayerAction, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    const { tick, money } = activeGameResult.value
    const actionRule = GAME_PLAYER_ACTION_RULES[actionType]
    if (money < actionRule.costMoney) {
      return Result.Failure(`You need ${actionRule.costMoney} money to select this action.`)
    }

    const upsertResult = await this.gamePlayerActionsRepository.upsert({
      gameId,
      playerId,
      tick,
      actionType,
    })
    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not set current game player action", { gameId, playerId, actionType, error: upsertResult.error })
      return upsertResult
    }

    return Result.Success(toGamePlayerAction(upsertResult.value))
  }

  private async getActiveGameForPlayer({
    gameId,
    playerId,
  }: {
    gameId: number
    playerId: number
  }): Promise<Result<{ tick: number; money: number }, string>> {
    const gameSummaryResult = await this.gamesRepository.getSummaryById({ gameId })
    if (Result.isFailure(gameSummaryResult)) {
      this.logger.error("Could not get game summary while resolving action context", { gameId, playerId, error: gameSummaryResult.error })
      return Result.Failure(gameSummaryResult.error)
    }

    const gameSummary = gameSummaryResult.value
    if (gameSummary === undefined) {
      return Result.Failure("Game does not exist.")
    }

    if (gameSummary.startedAt === null) {
      return Result.Failure("Game has not started.")
    }

    if (gameSummary.endedAt !== null) {
      return Result.Failure("Game has ended.")
    }

    if (!gameSummary.players.some((player) => player.id === playerId)) {
      return Result.Failure("Player is not in this game.")
    }

    const gameStateResult = await this.gameStatesRepository.getByGameIdAndPlayerId({ gameId, playerId })
    if (Result.isFailure(gameStateResult)) {
      this.logger.error("Could not get game state while resolving action context", { gameId, playerId, error: gameStateResult.error })
      return Result.Failure(gameStateResult.error)
    }

    const gameState = gameStateResult.value
    if (gameState === undefined) {
      return Result.Failure("Game state does not exist.")
    }

    return Result.Success({
      tick: gameState.tick,
      money: gameState.resources.money,
    })
  }
}

function toGamePlayerAction(gamePlayerActionRow: GamePlayerActionRow): GamePlayerAction {
  return {
    gameId: gamePlayerActionRow.gameId,
    playerId: gamePlayerActionRow.playerId,
    tick: gamePlayerActionRow.tick,
    actionType: gamePlayerActionRow.actionType,
    updatedAt: gamePlayerActionRow.updatedAt,
  }
}
