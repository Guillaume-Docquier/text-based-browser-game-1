import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { toLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import type { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import {
  GAME_PLAYER_ACTION_RULES,
  type GamePlayerAction,
  GamePlayerActionSchema,
  GamePlayerActionTypeSchema,
} from "#lib/db/gameplay/gamePlayerActions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { couldNot } from "#lib/errors.ts"
import { generateStarSystem } from "#lib/star-systems/generateStarSystem.ts"
import { computeNextTickDate } from "#tick-processing/computeNextTickDate.ts"
import { type OrderModel, type GameplayRepository, type PlayerViewModel, type StartGameModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly gameplayRepository: GameplayRepository
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({
    logger,
    gameplayRepository,
    lobbiesRepository,
  }: {
    logger: Logger
    gameplayRepository: GameplayRepository
    lobbiesRepository: LobbiesRepository
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.gameplayRepository = gameplayRepository
    this.lobbiesRepository = lobbiesRepository
  }

  public async startGame({ gameId, playerId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const getLobbyResult = await this.lobbiesRepository.getLobbyById({ gameId })
    if (Result.isFailure(getLobbyResult)) {
      this.logger.error("Failed to get lobby", { gameId, playerId, error: getLobbyResult.error })
      return Result.Failure(couldNot("start game"))
    }

    const lobbyModel = getLobbyResult.value
    if (lobbyModel === undefined) {
      this.logger.error("Lobby not found", { gameId, playerId })
      return Result.Failure(couldNot("start game"))
    }

    // I don't really like importing the lobbiesRepository and using toLobbyDto, but it is convenient
    const lobbyDto = toLobbyDto({ lobbyModel, playerId })
    if (!lobbyDto.canStart) {
      this.logger.error("Cannot start game, this player is not allowed to start it at the moment", { gameId, playerId, lobbyDto })
      return Result.Failure(couldNot("start game"))
    }

    const startedAt = new Date()
    const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: lobbyModel.configuration.tickIntervalSeconds })
    const starSystemResult = generateStarSystem({
      gameId,
      settings: lobbyModel.configuration.starSystemGenerationSettings,
    })
    if (Result.isFailure(starSystemResult)) {
      this.logger.error("Failed to generate Star System", { gameId, playerId, error: starSystemResult.error })
      return Result.Failure(couldNot("start game"))
    }

    const startGameModel: StartGameModel = {
      gameId,
      startedAt,
      nextTickAt,
      starSystem: starSystemResult.value,
      players: lobbyModel.players.reduce<StartGameModel["players"]>((players, player) => {
        players[player.id] = {
          resources: Object.values(ResourceType).map((resourceType) => ({
            resourceType,
            amount: STARTING_RESOURCE_AMOUNTS[resourceType],
          })),
        }

        return players
      }, {}),
    }

    const startGameResult = await this.gameplayRepository.startGame(startGameModel)
    if (Result.isFailure(startGameResult)) {
      this.logger.error("Failed to start game", { gameId, playerId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startGameResult
  }

  public async hasPlayerJoinedGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<boolean, string>> {
    return await this.lobbiesRepository.hasAccountJoinedLobby({ gameId, accountId: playerId })
  }

  public async getPlayerView({ gameId, playerId }: GetPlayerViewDto): Promise<Result<PlayerViewDto | undefined, string>> {
    const playerViewResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(playerViewResult)) {
      return playerViewResult
    }

    if (playerViewResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toPlayerViewDto(playerViewResult.value))
  }

  /**
   * @deprecated Temporary POC implementation
   */
  public async getCurrentAction({ gameId, playerId }: GetCurrentActionDto): Promise<Result<GamePlayerAction | null, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    const getCurrentActionResult = await this.gameplayRepository.getCurrentAction({
      gameId,
      playerId,
      tick: activeGameResult.value.tick,
    })
    if (Result.isFailure(getCurrentActionResult)) {
      return getCurrentActionResult
    }

    return Result.Success(getCurrentActionResult.value === null ? null : toGamePlayerAction(getCurrentActionResult.value))
  }

  /**
   * @deprecated Temporary POC implementation
   */
  public async setCurrentAction({
    gameId,
    tick,
    playerId,
    actionType,
  }: SetCurrentActionDto): Promise<Result<GamePlayerAction | null, string>> {
    const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId })
    if (Result.isFailure(activeGameResult)) {
      return activeGameResult
    }

    if (activeGameResult.value.tick !== tick) {
      return Result.Failure(`Cannot submit action for tick ${tick}, the game is currently at tick ${activeGameResult.value.tick}.`)
    }

    if (actionType === null) {
      const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, tick })
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

    const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, playerId, tick, actionType })
    if (Result.isFailure(upsertResult)) {
      return upsertResult
    }

    return Result.Success(toGamePlayerAction(upsertResult.value))
  }

  /**
   * @deprecated Temporary POC implementation
   */
  private async getActiveGameForPlayer({
    gameId,
    playerId,
  }: {
    gameId: GameId
    playerId: PlayerId
  }): Promise<Result<{ tick: number; money: number }, string>> {
    const getLobbyResult = await this.lobbiesRepository.getLobbyById({ gameId })
    if (Result.isFailure(getLobbyResult)) {
      return getLobbyResult
    }

    const lobby = getLobbyResult.value
    if (lobby === undefined) {
      this.logger.error("Cannot resolve action context because game does not exist", { gameId, playerId })
      return Result.Failure("Game does not exist.")
    }

    if (lobby.startedAt === null) {
      this.logger.error("Cannot resolve action context because game has not started", { gameId, playerId })
      return Result.Failure("Game has not started.")
    }

    if (!lobby.players.some((player) => player.id === playerId)) {
      this.logger.error("Cannot resolve action context because player is not in game", { gameId, playerId })
      return Result.Failure("Player is not in this game.")
    }

    const gameStateResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
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

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  return {
    gameId: playerViewModel.gameId,
    playerId: playerViewModel.playerId,
    tick: playerViewModel.tick,
    nextTickAt: playerViewModel.nextTickAt,
    resources: playerViewModel.resources,
  }
}

function toGamePlayerAction(gamePlayerActionModel: OrderModel): GamePlayerAction {
  return {
    gameId: gamePlayerActionModel.gameId,
    playerId: gamePlayerActionModel.playerId,
    tick: gamePlayerActionModel.tick,
    actionType: gamePlayerActionModel.actionType,
    updatedAt: gamePlayerActionModel.updatedAt,
  }
}

export type StartGameDto = z.infer<typeof StartGameDto>
export const StartGameDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type StartedGameDto = z.infer<typeof StartedGameDto>
export const StartedGameDto = z.object({
  nextTickAt: z.date(),
})

export type GetPlayerViewDto = z.infer<typeof GetPlayerViewDto>
export const GetPlayerViewDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  tick: z.number(),
  nextTickAt: z.date(),
  resources: z.object({
    money: z.number(),
  }),
})

export type GetCurrentActionDto = z.infer<typeof GetCurrentActionDto>
export const GetCurrentActionDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type SetCurrentActionDto = z.infer<typeof SetCurrentActionDto>
export const SetCurrentActionDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
  tick: z.coerce.number(),
  actionType: GamePlayerActionTypeSchema.nullable(),
})

export const CurrentActionDto = z.object({
  action: GamePlayerActionSchema.nullable(),
})
