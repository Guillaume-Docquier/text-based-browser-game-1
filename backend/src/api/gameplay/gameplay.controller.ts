import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { toLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import type { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import {
  GAME_PLAYER_ACTION_RULES,
  type GamePlayerAction,
  GamePlayerActionSchema,
  GamePlayerActionTypeSchema,
} from "#lib/db/gameplay/gamePlayerActions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { computeNextTickDate } from "#tick-processing/computeNextTickDate.ts"
import { type GamePlayerActionModel, type GameplayRepository, type PlayerViewModel, type StartGameModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gameplayRepository: GameplayRepository
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({
    logger,
    createTransaction,
    gameplayRepository,
    lobbiesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gameplayRepository: GameplayRepository
    lobbiesRepository: LobbiesRepository
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.createTransaction = createTransaction
    this.gameplayRepository = gameplayRepository
    this.lobbiesRepository = lobbiesRepository
  }

  public async startGame({ gameId, playerId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const getLobbyResult = await this.lobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(getLobbyResult, "Failed to get game lobby")

        const lobbyModel = getLobbyResult.value
        if (lobbyModel === undefined) {
          throw new TransactionRollback("Cannot start game, the lobby could not be found")
        }

        // I don't really like importing the lobbiesRepository and using toLobbyDto, but it is convenient
        if (!toLobbyDto({ lobbyModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = new Date()
        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: lobbyModel.configuration.tickIntervalSeconds })
        const startGameModel: StartGameModel = {
          gameId,
          startedAt,
          nextTickAt,
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

        const startGameResult = await this.gameplayRepository.startGame(startGameModel, tx)
        rollbackOnFailure(startGameResult, "Failed to persist starting game state")

        return startGameResult.value
      }),
    )

    if (Result.isFailure(gameStartResult)) {
      this.logger.error("Could not start game", { gameId, playerId, error: gameStartResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return gameStartResult
  }

  public async getPlayerView({ gameId, playerId }: GetPlayerViewDto): Promise<Result<PlayerViewDto | undefined, string>> {
    const gameStateResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(gameStateResult)) {
      return gameStateResult
    }

    if (gameStateResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toGameStateDto(gameStateResult.value))
  }

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

function toGameStateDto(playerGameStateModel: PlayerViewModel): PlayerViewDto {
  return {
    gameId: playerGameStateModel.gameId,
    playerId: playerGameStateModel.playerId,
    tick: playerGameStateModel.tick,
    nextTickAt: playerGameStateModel.nextTickAt,
    resources: playerGameStateModel.resources,
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
