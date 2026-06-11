import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameLobbiesRepository } from "#api/game-lobbies/gameLobbies.repository.ts"
import type { GameId } from "#api/games/GameId.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"
import type { GamePlayerActionsRepository, GamePlayerActionModel } from "#lib/db/gamePlayerActions.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GAME_PLAYER_ACTION_RULES, type GamePlayerAction } from "#lib/gamePlayerActions.ts"
import { type GamePlayerActionType } from "#lib/gamePlayerActionType.ts"

export class GamePlayerActionsController {
  private readonly gamePlayerActionsRepository: GamePlayerActionsRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gameLobbiesRepository: GameLobbiesRepository
  private readonly logger: Logger

  public constructor({
    gamePlayerActionsRepository,
    gameStatesRepository,
    gameLobbiesRepository,
    logger,
  }: {
    gamePlayerActionsRepository: GamePlayerActionsRepository
    gameStatesRepository: GameStatesRepository
    gameLobbiesRepository: GameLobbiesRepository
    logger: Logger
  }) {
    this.gamePlayerActionsRepository = gamePlayerActionsRepository
    this.gameStatesRepository = gameStatesRepository
    this.gameLobbiesRepository = gameLobbiesRepository
    this.logger = logger.child({ scope: "game-player-actions-controller" })
  }

  public async getCurrentAction({
    gameId,
    playerId,
  }: {
    gameId: GameId
    playerId: PlayerId
  }): Promise<Result<GamePlayerAction | null, string>> {
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
    if (currentAction === null) {
      return Result.Success(null)
    }

    return Result.Success(toGamePlayerAction(currentAction))
  }

  public async setCurrentAction({
    gameId,
    tick,
    playerId,
    actionType,
  }: {
    gameId: GameId
    playerId: PlayerId
    tick: number
    actionType: GamePlayerActionType | null
  }): Promise<Result<GamePlayerAction | null, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    if (activeGameResult.value.tick !== tick) {
      return Result.Failure(`Cannot submit action for tick ${tick}, the game is currently at tick ${activeGameResult.value.tick}.`)
    }

    if (actionType === null) {
      const deleteResult = await this.gamePlayerActionsRepository.deleteByGameIdPlayerIdAndTick({
        gameId,
        playerId,
        tick,
      })
      if (Result.isFailure(deleteResult)) {
        return deleteResult
      }

      return Result.Success(null)
    }

    const actionRule = GAME_PLAYER_ACTION_RULES[actionType]
    if (activeGameResult.value.money < actionRule.costMoney) {
      this.logger.error("Player cannot afford selected game player action", {
        gameId,
        playerId,
        actionType,
        money: activeGameResult.value.money,
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
    gameId: GameId
    playerId: PlayerId
  }): Promise<Result<{ tick: number; money: number }, string>> {
    const gameLobbyResult = await this.gameLobbiesRepository.getGameLobbyById({ gameId })
    if (Result.isFailure(gameLobbyResult)) {
      return gameLobbyResult
    }

    const gameSummary = gameLobbyResult.value
    if (gameSummary === undefined) {
      this.logger.error("Cannot resolve action context because game does not exist", { gameId, playerId })
      return Result.Failure("Game does not exist.")
    }

    if (gameSummary.startedAt === null) {
      this.logger.error("Cannot resolve action context because game has not started", { gameId, playerId })
      return Result.Failure("Game has not started.")
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

function toGamePlayerAction(gamePlayerActionModel: GamePlayerActionModel): GamePlayerAction {
  return {
    gameId: gamePlayerActionModel.gameId,
    playerId: gamePlayerActionModel.playerId,
    tick: gamePlayerActionModel.tick,
    actionType: gamePlayerActionModel.actionType,
    updatedAt: gamePlayerActionModel.updatedAt,
  }
}
