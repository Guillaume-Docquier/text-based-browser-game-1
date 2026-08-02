import { Datetime, type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { generateStarSystem } from "#api/gameplay/star-systems/generateStarSystem.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { ACTION_RULES, ActionDto, ActionTypeSchema } from "#lib/db/gameplay/actions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type ActionModel, type GameplayRepository, type PlayerViewModel } from "./gameplay.repository.ts"

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

  public async startGame({ gameId, requesterAccountId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const startGameResult = await this.createTransaction(async (tx) => {
      const gameForStart = await this.gameplayRepository.getGameForStart({ gameId }, tx)
      rollbackOnFailure(gameForStart, "Game cannot start")

      if (gameForStart.value.createdByAccountId !== requesterAccountId) {
        throw new TransactionRollback("Only the game creator can start it.")
      }

      if (gameForStart.value.status !== GameStatus.WAITING_FOR_PLAYERS && gameForStart.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollback("The game cannot start in its current status.", {
          cause: { status: gameForStart.value.status, expected: [GameStatus.WAITING_FOR_PLAYERS, GameStatus.READY_TO_START] },
        })
      }

      const startedAt = this.clock.now()
      const nextTurnAt = Datetime.increment({ date: startedAt, time: gameForStart.value.turnInterval })
      const starSystemResult = generateStarSystem({ settings: gameForStart.value.starSystemGenerationSettings, clock: this.clock })
      rollbackOnFailure(starSystemResult, "Failed to generate Star System")

      const startingResources = Object.values(ResourceType).map((resourceType) => ({
        resourceType,
        amount: STARTING_RESOURCE_AMOUNTS[resourceType],
      }))
      const playerResources = gameForStart.value.playerIds.flatMap((playerId) =>
        startingResources.map((resource) => ({ playerId, ...resource })),
      )

      await this.gameplayRepository.startGame(
        {
          game: gameForStart.value,
          status: GameStatus.COLLECTING_ACTIONS,
          startedAt,
          nextTurnAt,
          starSystem: starSystemResult.value,
          playerResources,
        },
        tx,
      )

      return { nextTurnAt }
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Could not start game", { gameId, requesterAccountId, error: startGameResult.error })
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
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async getCurrentAction({ gameId, playerId }: GetCurrentActionDto): Promise<Result<ActionDto | null, string>> {
    const getCurrentActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getPlayerActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      const currentActionResult = await this.gameplayRepository.getCurrentAction(
        {
          gameId,
          playerId,
          turn: activeGameResult.value.turn,
        },
        tx,
      )
      rollbackOnFailure(currentActionResult, "Failed to get current action")

      return currentActionResult.value === null ? null : toActionDto(currentActionResult.value)
    })

    if (Result.isFailure(getCurrentActionResult)) {
      this.logger.error("Failed to get current action", { gameId, playerId, error: getCurrentActionResult.error })
      return Result.Failure(getCurrentActionResult.error.message)
    }

    return Result.Success(getCurrentActionResult.value)
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async setCurrentAction({ gameId, turn, playerId, actionType }: SetCurrentActionDto): Promise<Result<ActionDto | null, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getPlayerActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      if (activeGameResult.value.turn !== turn) {
        throw new TransactionRollback(
          `Cannot submit action for turn ${turn}, the game is currently at turn ${activeGameResult.value.turn}.`,
        )
      }

      if (actionType === null) {
        const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, turn }, tx)
        rollbackOnFailure(deleteResult, "Failed to clear action")

        return null
      }

      const actionRule = ACTION_RULES[actionType]
      if (activeGameResult.value.money < actionRule.costMoney) {
        this.logger.error("Player cannot afford selected action", {
          gameId,
          playerId,
          actionType,
          money: activeGameResult.value.money,
          costMoney: actionRule.costMoney,
        })
        throw new TransactionRollback(`You need ${actionRule.costMoney} money to select this action.`)
      }

      const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, playerId, turn, actionType }, tx)
      rollbackOnFailure(upsertResult, "Failed to upsert action")

      return toActionDto(upsertResult.value)
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", { gameId, turn, playerId, actionType, error: setActionResult.error })
      return Result.Failure(setActionResult.error.message)
    }

    return Result.Success(setActionResult.value)
  }
}

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  return {
    gameId: playerViewModel.gameId,
    player: playerViewModel.player,
    opponents: playerViewModel.opponents,
    turn: playerViewModel.turn,
    nextTurnAt: playerViewModel.nextTurnAt,
    starSystem: playerViewModel.starSystem,
    resources: playerViewModel.resources,
  }
}

function toActionDto(actionModel: ActionModel): ActionDto {
  return {
    gameId: actionModel.gameId,
    playerId: actionModel.playerId,
    turn: actionModel.turn,
    actionType: actionModel.actionType,
    updatedAt: actionModel.updatedAt,
  }
}

export type StartGameDto = z.infer<typeof StartGameDto>
export const StartGameDto = z.object({
  gameId: z.coerce.number(),
  requesterAccountId: AccountId,
})

export type StartedGameDto = z.infer<typeof StartedGameDto>
export const StartedGameDto = z.object({
  nextTurnAt: z.date(),
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

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDto>
export const PlayerViewPlayerDto = z.object({ id: PlayerId, color: z.enum(PlayerColor) })

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  player: PlayerViewPlayerDto,
  opponents: z.record(PlayerId, PlayerViewPlayerDto),
  turn: z.number(),
  nextTurnAt: z.date(),
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
  turn: z.coerce.number(),
  actionType: ActionTypeSchema.nullable(),
})

export const CurrentActionDto = z.object({
  action: ActionDto.nullable(),
})
