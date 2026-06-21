import { Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { generateStarSystem } from "#api/gameplay/star-systems/generateStarSystem.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction, Transaction } from "#lib/db/createDb.ts"
import {
  GAME_PLAYER_ACTION_RULES,
  type GamePlayerAction,
  GamePlayerActionSchema,
  GamePlayerActionTypeSchema,
} from "#lib/db/gameplay/gamePlayerActions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/gameplay/GameStatus.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type GameplayRepository, type OrderModel, type PlayerViewModel, type StartGameModel } from "./gameplay.repository.ts"

export class GameplayController {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gameplayRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "gameplay-controller" })
    this.clock = clock
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
  }

  public async startGame({ gameId, playerId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const startGameResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const contextResult = await this.gameplayRepository.getStartGameContextForMutation({ gameId }, tx)
        rollbackOnFailure(contextResult, "Failed to get game start context")

        const context = contextResult.value
        if (context === undefined) {
          throw new TransactionRollback("Cannot start game because it does not exist")
        }

        if (
          (context.status !== GameStatus.WAITING_FOR_PLAYERS && context.status !== GameStatus.READY_TO_START) ||
          context.creatorPlayerId !== playerId
        ) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = this.clock.now()
        const nextTickAt = Datetime.increment({
          date: startedAt,
          time: Time.create(context.tickIntervalSeconds, UnitOfTime.SECONDS),
        })
        const starSystemResult = generateStarSystem({ settings: context.starSystemGenerationSettings, clock: this.clock })
        rollbackOnFailure(starSystemResult, "Failed to generate Star System")

        const startModel: StartGameModel = {
          gameId,
          startedAt,
          nextTickAt,
          starSystem: starSystemResult.value,
          players: context.playerIds.reduce<StartGameModel["players"]>((players, currentPlayerId) => {
            players[currentPlayerId] = {
              resources: Object.values(ResourceType).map((resourceType) => ({
                resourceType,
                amount: STARTING_RESOURCE_AMOUNTS[resourceType],
              })),
            }
            return players
          }, {}),
        }

        const persistResult = await this.gameplayRepository.startGame(startModel, tx)
        rollbackOnFailure(persistResult, "Failed to persist started game")
        return persistResult.value
      }),
    )

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Failed to start game", { gameId, playerId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startGameResult
  }

  public async hasPlayerJoinedGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<boolean, string>> {
    return await this.gameplayRepository.hasPlayerJoinedGame({ gameId, playerId })
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
    const transactionResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<Result<GamePlayerAction | null, string>> => {
        const activeGameResult = await this.getActiveGameForPlayer({ gameId, playerId }, tx)
        if (Result.isFailure(activeGameResult)) {
          return activeGameResult
        }

        if (activeGameResult.value.tick !== tick) {
          return Result.Failure(`Cannot submit action for tick ${tick}, the game is currently at tick ${activeGameResult.value.tick}.`)
        }

        if (actionType === null) {
          const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, tick }, tx)
          rollbackOnFailure(deleteResult, "Failed to clear current action")
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

        const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, playerId, tick, actionType }, tx)
        rollbackOnFailure(upsertResult, "Failed to set current action")
        return Result.Success(toGamePlayerAction(upsertResult.value))
      }),
    )

    if (Result.isFailure(transactionResult)) {
      this.logger.error("Could not set current action", { gameId, tick, playerId, actionType, error: transactionResult.error })
      return Result.Failure(couldNot("set current action"))
    }

    return transactionResult.value
  }

  /**
   * @deprecated Temporary POC implementation
   */
  private async getActiveGameForPlayer(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    tx?: Transaction,
  ): Promise<Result<{ tick: number; money: number }, string>> {
    const contextResult =
      tx === undefined
        ? await this.gameplayRepository.getGamePlayerContext({ gameId, playerId })
        : await this.gameplayRepository.getGamePlayerContextForMutation({ gameId, playerId }, tx)
    if (Result.isFailure(contextResult)) {
      return contextResult
    }

    const context = contextResult.value
    if (context === undefined) {
      this.logger.error("Cannot resolve action context because game does not exist", { gameId, playerId })
      return Result.Failure("Game does not exist.")
    }

    if (context.status !== GameStatus.STARTED) {
      this.logger.error("Cannot resolve action context because game is not active", { gameId, playerId, status: context.status })
      return Result.Failure("Game is not active.")
    }

    if (!context.hasPlayerJoined) {
      this.logger.error("Cannot resolve action context because player is not in game", { gameId, playerId })
      return Result.Failure("Player is not in this game.")
    }

    if (context.tick === undefined || context.money === undefined) {
      this.logger.error("Cannot resolve action context because game state does not exist", { gameId, playerId })
      return Result.Failure("Game state does not exist.")
    }

    return Result.Success({ tick: context.tick, money: context.money })
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
