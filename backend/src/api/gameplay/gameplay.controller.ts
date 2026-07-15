import { Datetime, type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { generateStarSystem } from "#api/gameplay/star-systems/generateStarSystem.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import type { MovementTarget } from "#lib/db/gameplay/MovementTarget.ts"
import { UnitId } from "#lib/db/gameplay/UnitId.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type GameplayRepository, type PlayerViewModel } from "./gameplay.repository.ts"

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
      const nextTickAt = Datetime.increment({ date: startedAt, time: gameForStart.value.tickInterval })
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
          status: GameStatus.COLLECTING_ORDERS,
          startedAt,
          nextTickAt,
          starSystem: starSystemResult.value,
          playerResources,
        },
        tx,
      )

      return { nextTickAt }
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
  public async getCurrentAction({ gameId, playerId }: GetCurrentActionDto): Promise<Result<GamePlayerActionDto | null, string>> {
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

      return currentActionResult.value
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
  public async setCurrentAction({
    gameId,
    tick,
    playerId,
    action,
  }: SetCurrentActionDto): Promise<Result<GamePlayerActionDto | null, string>> {
    const setActionResult = await this.createTransaction(async (tx) => {
      const activeGameResult = await this.gameplayRepository.getPlayerActionContext({ gameId, playerId }, tx)
      rollbackOnFailure(activeGameResult, "Failed to resolve action context")

      if (activeGameResult.value.tick !== tick) {
        throw new TransactionRollback(
          `Cannot submit action for tick ${tick}, the game is currently at tick ${activeGameResult.value.tick}.`,
        )
      }

      if (action === null) {
        const deleteResult = await this.gameplayRepository.clearCurrentAction({ gameId, playerId, tick }, tx)
        rollbackOnFailure(deleteResult, "Failed to clear game player action")

        return null
      }

      const actionRule = GAME_PLAYER_ACTION_RULES[action.actionType]
      if (activeGameResult.value.money < actionRule.costMoney) {
        this.logger.error("Player cannot afford selected game player action", {
          gameId,
          playerId,
          actionType: action.actionType,
          money: activeGameResult.value.money,
          costMoney: actionRule.costMoney,
        })
        throw new TransactionRollback(`You need ${actionRule.costMoney} money to select this action.`)
      }

      if (action.actionType === GamePlayerActionType.BUILD_UNIT) {
        const targetExistsResult = await this.gameplayRepository.movementTargetExists({ gameId, target: action.destination }, tx)
        rollbackOnFailure(targetExistsResult, "Failed to validate Build destination")
        if (!targetExistsResult.value) {
          throw new TransactionRollback("The Build destination does not belong to this game.")
        }
      }

      const upsertResult = await this.gameplayRepository.setCurrentAction({ gameId, playerId, tick, action }, tx)
      rollbackOnFailure(upsertResult, "Failed to upsert game player action")

      return upsertResult.value
    })

    if (Result.isFailure(setActionResult)) {
      this.logger.error("Failed to set current action", { gameId, tick, playerId, action, error: setActionResult.error })
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
    tick: playerViewModel.tick,
    nextTickAt: playerViewModel.nextTickAt,
    starSystem: playerViewModel.starSystem,
    units: playerViewModel.units,
    resources: playerViewModel.resources,
  }
}

export type StartGameDto = z.infer<typeof StartGameDto>
export const StartGameDto = z.object({
  gameId: z.coerce.number(),
  requesterAccountId: AccountId,
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

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDto>
export const PlayerViewPlayerDto = z.object({ id: PlayerId, color: z.enum(PlayerColor) })

export type MovementTargetDto = z.infer<typeof MovementTargetDto>
export const MovementTargetDto = z.discriminatedUnion("targetType", [
  z.object({ targetType: z.literal("SECTOR"), sectorId: z.string() }),
  z.object({ targetType: z.literal("BODY"), bodyId: z.string() }),
]) satisfies z.ZodType<MovementTarget>

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  player: PlayerViewPlayerDto,
  opponents: z.record(PlayerId, PlayerViewPlayerDto),
  tick: z.number(),
  nextTickAt: z.date(),
  starSystem: StarSystemDto,
  units: z.record(
    UnitId,
    z.object({
      id: UnitId,
      playerId: PlayerId,
      location: MovementTargetDto,
    }),
  ),
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
  action: z
    .discriminatedUnion("actionType", [
      z.object({ actionType: z.literal(GamePlayerActionType.MAKE_MORE_MONEY) }),
      z.object({ actionType: z.literal(GamePlayerActionType.WIN_THE_GAME) }),
      z.object({
        actionType: z.literal(GamePlayerActionType.BUILD_UNIT),
        destination: MovementTargetDto,
      }),
    ])
    .nullable(),
})

const GamePlayerActionCommonDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  tick: z.number(),
  updatedAt: z.date(),
})

export type GamePlayerActionDto = z.infer<typeof GamePlayerActionDto>
export const GamePlayerActionDto = z.discriminatedUnion("actionType", [
  GamePlayerActionCommonDto.extend({ actionType: z.literal(GamePlayerActionType.MAKE_MORE_MONEY) }),
  GamePlayerActionCommonDto.extend({ actionType: z.literal(GamePlayerActionType.WIN_THE_GAME) }),
  GamePlayerActionCommonDto.extend({
    actionType: z.literal(GamePlayerActionType.BUILD_UNIT),
    destination: MovementTargetDto,
  }),
])

export const CurrentActionDto = z.object({
  action: GamePlayerActionDto.nullable(),
})
