import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type LobbyDto, toLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import {
  GAME_PLAYER_ACTION_RULES,
  type GamePlayerAction,
  GamePlayerActionSchema,
  GamePlayerActionTypeSchema,
} from "#lib/gamePlayerActions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/gameResources.ts"
import { computeNextTickDate } from "#tick-processing/processTick.ts"
import { type GamePlayerActionModel, type GameplayRepository, type PlayerGameStateModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gameplayRepository: GameplayRepository

  public constructor({
    logger,
    createTransaction,
    gameplayRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gameplayRepository: GameplayRepository
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.createTransaction = createTransaction
    this.gameplayRepository = gameplayRepository
  }

  public async start({ gameId, playerId }: StartGameplayDto): Promise<Result<LobbyDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const lobbyResult = await this.gameplayRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(lobbyResult, "Failed to get game lobby")

        const lobbyModel = lobbyResult.value
        if (lobbyModel === undefined) {
          throw new TransactionRollback("Cannot start game, the lobby could not be found")
        }

        if (!toLobbyDto({ lobbyModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = new Date()
        const startGameResult = await this.gameplayRepository.updateGame({ gameId }, { startedAt }, tx)
        rollbackOnFailure(startGameResult, "Failed to update game start date")

        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: lobbyModel.configuration.tickIntervalSeconds })
        const gameStateResult = await this.gameplayRepository.createGameState({ gameId, nextTickAt }, tx)
        rollbackOnFailure(gameStateResult, "Failed to create initial game state")

        const playerIdsResult = await this.gameplayRepository.getPlayerIds({ gameId }, tx)
        rollbackOnFailure(playerIdsResult, "Failed to get player ids to setup initial resources")

        const createStartingResourcesResult = await this.gameplayRepository.createStartingResources(
          playerIdsResult.value.flatMap((resourcePlayerId) =>
            Object.values(ResourceType).map((resourceType) => ({
              gameId,
              playerId: resourcePlayerId,
              resourceType,
              amount: STARTING_RESOURCE_AMOUNTS[resourceType],
            })),
          ),
          tx,
        )
        rollbackOnFailure(createStartingResourcesResult, "Failed to create initial resources")

        const gameTickResult = await this.gameplayRepository.createGameTick(
          { gameId, tick: gameStateResult.value.tick, scheduledFor: gameStateResult.value.nextTickAt },
          tx,
        )
        rollbackOnFailure(gameTickResult, "Failed to schedule first game tick")
      }),
    )

    if (Result.isFailure(gameStartResult)) {
      this.logger.error("Could not start game", { gameId, playerId, error: gameStartResult.error })
      return Result.Failure(couldNot("start game"))
    }

    const lobbyResult = await this.gameplayRepository.getLobbyById({ gameId })
    Assert.isSuccess(lobbyResult)
    Assert.isDefined(lobbyResult.value)

    return Result.Success(toLobbyDto({ lobbyModel: lobbyResult.value, playerId }))
  }

  public async getById({ gameId, playerId }: GetGameplayDto): Promise<Result<GameStateDto | undefined, string>> {
    const gameStateResult = await this.gameplayRepository.getPlayerGameState({ gameId, playerId })
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
    const lobbyResult = await this.gameplayRepository.getLobbyById({ gameId })
    if (Result.isFailure(lobbyResult)) {
      return lobbyResult
    }

    const lobby = lobbyResult.value
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

    const gameStateResult = await this.gameplayRepository.getPlayerGameState({ gameId, playerId })
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

function toGameStateDto(playerGameStateModel: PlayerGameStateModel): GameStateDto {
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

export type StartGameplayDto = z.infer<typeof StartGameplayDto>
export const StartGameplayDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type GetGameplayDto = z.infer<typeof GetGameplayDto>
export const GetGameplayDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type GameStateDto = z.infer<typeof GameStateDto>
export const GameStateDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  tick: z.number(),
  nextTickAt: z.date(),
  resources: z.object({
    money: z.number(),
  }),
})

export const GameplayDto = z.object({
  gameState: GameStateDto,
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
