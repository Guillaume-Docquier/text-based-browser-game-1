import { Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { generateStarSystem } from "#api/gameplay/star-systems/generateStarSystem.ts"
import { GameId } from "#api/shared/GameId.ts"
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
    const startGameResult = await this.createTransaction(async (tx) => {
      const contextResult = await this.gameplayRepository.getStartGameContext({ gameId, playerId }, tx)
      rollbackOnFailure(contextResult, "Failed to get start game context")

      const startGameContext = contextResult.value
      if (startGameContext === undefined) {
        throw new TransactionRollback("Game not found")
      }

      if (!startGameContext.canStart) {
        throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment", {
          cause: { gameStatus: startGameContext.status },
        })
      }

      const startedAt = this.clock.now()
      const nextTickAt = Datetime.increment({
        date: startedAt,
        time: Time.create(startGameContext.configuration.tickIntervalSeconds, UnitOfTime.SECONDS),
      })
      const starSystemResult = generateStarSystem({
        settings: startGameContext.configuration.starSystemGenerationSettings,
        clock: this.clock,
      })
      rollbackOnFailure(starSystemResult, "Failed to generate Star System")

      const startGameModel: StartGameModel = {
        gameId,
        startedAt,
        nextTickAt,
        starSystem: starSystemResult.value,
        players: startGameContext.players.reduce<StartGameModel["players"]>((players, player) => {
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
    const getCurrentActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getPlayerActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      const currentActionResult = await this.gameplayRepository.getCurrentAction(
        {
          gameId,
          playerId,
          tick: activeGameResult.value.tick,
        },
        tx,
      )
      rollbackOnFailure(currentActionResult, "Failed to get current action")

      return currentActionResult.value === null ? null : toGamePlayerAction(currentActionResult.value)
    })

    if (Result.isFailure(getCurrentActionResult)) {
      this.logger.error("Failed to get current action", { gameId, playerId, error: getCurrentActionResult.error })
      return Result.Failure(getCurrentActionResult.error.message)
    }

    return Result.Success(getCurrentActionResult.value)
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
