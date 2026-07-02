import { Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { generateStarSystem } from "#api/gameplay/star-systems/generateStarSystem.ts"
import { toLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import type { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { GameId } from "#api/shared/GameId.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import {
  GAME_PLAYER_ACTION_RULES,
  type GamePlayerAction,
  GamePlayerActionSchema,
  GamePlayerActionTypeSchema,
} from "#lib/db/gameplay/gamePlayerActions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type GameplayRepository, type OrderModel, type PlayerViewModel, type StartGameModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gameplayRepository: GameplayRepository
  private readonly lobbiesRepository: LobbiesRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gameplayRepository,
    lobbiesRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gameplayRepository: GameplayRepository
    lobbiesRepository: LobbiesRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.clock = clock
    this.gameplayRepository = gameplayRepository
    this.lobbiesRepository = lobbiesRepository
    this.createTransaction = createTransaction
  }

  public async startGame({ gameId, playerId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const startGameResult = await this.createTransaction(async (tx) => {
      const getLobbyResult = await this.lobbiesRepository.getLobbyById({ gameId }, tx, { lockGame: true })
      rollbackOnFailure(getLobbyResult, "Failed to get lobby")

      const lobbyModel = getLobbyResult.value
      if (lobbyModel === undefined) {
        this.logger.error("Lobby not found", { gameId, playerId })
        throw new TransactionRollback("Cannot start missing game lobby")
      }

      // I don't really like importing the lobbiesRepository and using toLobbyDto, but it is convenient
      const lobbyDto = toLobbyDto({ lobbyModel, playerId })
      if (!lobbyDto.canStart) {
        this.logger.error("Cannot start game, this player is not allowed to start it at the moment", { gameId, playerId, lobbyDto })
        throw new TransactionRollback("Cannot start game in its current status")
      }

      const startedAt = this.clock.now()
      const nextTickAt = Datetime.increment({
        date: startedAt,
        time: Time.create(lobbyModel.configuration.tickIntervalSeconds, UnitOfTime.SECONDS),
      })
      const starSystemResult = generateStarSystem({ settings: lobbyModel.configuration.starSystemGenerationSettings, clock: this.clock })
      rollbackOnFailure(starSystemResult, "Failed to generate Star System")

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

      const startResult = await this.gameplayRepository.startGame(startGameModel, tx)
      rollbackOnFailure(startResult, "Failed to start game")

      return startResult.value
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Failed to start game", { gameId, playerId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return Result.Success(startGameResult.value)
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
    const setActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getPlayerActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      if (activeGameResult.value.tick !== tick) {
        throw new TransactionRollback(
          `Cannot submit action for tick ${tick}, the game is currently at tick ${activeGameResult.value.tick}.`,
        )
      }

      if (actionType === null) {
        const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, tick }, tx)
        rollbackOnFailure(deleteResult, "Failed to clear game player action")

        return null
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
        throw new TransactionRollback(`You need ${actionRule.costMoney} money to select this action.`)
      }

      const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, playerId, tick, actionType }, tx)
      rollbackOnFailure(upsertResult, "Failed to upsert game player action")

      return toGamePlayerAction(upsertResult.value)
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", { gameId, tick, playerId, actionType, error: setActionResult.error })
      return Result.Failure(setActionResult.error.message)
    }

    return Result.Success(setActionResult.value)
  }

  /**
   * @deprecated Temporary POC implementation
   */ private async getActiveGameForPlayer({
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

    if (lobby.status !== GameStatus.COLLECTING_ORDERS) {
      this.logger.error("Cannot resolve action context because game is not collecting orders", { gameId, playerId, status: lobby.status })
      return Result.Failure("Game is not collecting orders.")
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
    starSystem: playerViewModel.starSystem,
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

const StarSystemBodyDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: z.enum(BodyType),
  movementNodeId: z.string(),
})

const StarSystemSectorDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  angleRange: RangeDto,
  bodies: z.array(StarSystemBodyDto),
  movementNodeId: z.string(),
})

const StarSystemOrbitDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(StarSystemSectorDto),
})

const MovementEdgeDto = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  weight: z.number(),
})

type StarSystemDto = z.infer<typeof StarSystemDto>
const StarSystemDto = z.object({
  orbits: z.array(StarSystemOrbitDto),
  movementEdges: z.record(z.string(), z.array(MovementEdgeDto)),
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
  starSystem: StarSystemDto,
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
