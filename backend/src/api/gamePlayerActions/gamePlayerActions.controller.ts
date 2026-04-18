import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamePlayerActionsRepository, GamePlayerActionRow } from "#lib/db/gamePlayerActions.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import { type GamePlayerAction, GAME_PLAYER_ACTION_RULES, type GamePlayerActionType } from "#lib/gamePlayerActions.ts"

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

  public async getCurrentAction({
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

    const getCurrentActionResult = await this.gamePlayerActionsRepository.getByGameIdPlayerIdAndTick({
      gameId,
      playerId,
      tick: activeGameResult.value.tick,
    })
    if (Result.isFailure(getCurrentActionResult)) {
      return getCurrentActionResult
    }

    const currentAction = getCurrentActionResult.value
    if (currentAction === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toGamePlayerAction(currentAction))
  }

  public async setCurrentAction({
    gameId,
    playerId,
    actionType,
  }: {
    gameId: number
    playerId: number
    actionType: GamePlayerActionType | null
  }): Promise<Result<GamePlayerAction | undefined, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    const { tick, money } = activeGameResult.value
    if (actionType === null) {
      const deleteResult = await this.gamePlayerActionsRepository.deleteByGameIdPlayerIdAndTick({
        gameId,
        playerId,
        tick,
      })
      if (Result.isFailure(deleteResult)) {
        return deleteResult
      }

      return Result.Success(undefined)
    }

    const actionRule = GAME_PLAYER_ACTION_RULES[actionType]
    if (money < actionRule.costMoney) {
      this.logger.error("Player cannot afford selected game player action", {
        gameId,
        playerId,
        actionType,
        money,
        costMoney: actionRule.costMoney,
      })
      return Result.Failure(`You need ${actionRule.costMoney} money to select this action.`)
    }

    const upsertResult = await this.gamePlayerActionsRepository.upsert({
      gameId,
      playerId,
      tick,
      actionType,
    })
    if (Result.isFailure(upsertResult)) {
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
      return gameSummaryResult
    }

    const gameSummary = gameSummaryResult.value
    if (gameSummary === undefined) {
      this.logger.error("Cannot resolve action context because game does not exist", { gameId, playerId })
      return Result.Failure("Game does not exist.")
    }

    if (gameSummary.startedAt === null) {
      this.logger.error("Cannot resolve action context because game has not started", { gameId, playerId })
      return Result.Failure("Game has not started.")
    }

    if (gameSummary.endedAt !== null) {
      this.logger.error("Cannot resolve action context because game has ended", { gameId, playerId, endedAt: gameSummary.endedAt })
      return Result.Failure("Game has ended.")
    }

    if (!gameSummary.players.some((player) => player.id === playerId)) {
      this.logger.error("Cannot resolve action context because player is not in game", { gameId, playerId })
      return Result.Failure("Player is not in this game.")
    }

    const gameStateResult = await this.gameStatesRepository.getByGameIdAndPlayerId({ gameId, playerId })
    if (Result.isFailure(gameStateResult)) {
      return gameStateResult
    }

    const gameState = gameStateResult.value
    if (gameState === undefined) {
      this.logger.error("Cannot resolve action context because game state does not exist", { gameId, playerId })
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
