import { createRng, Datetime, Distance, type Logger, mulberry32Prng, Result, Timer, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { GameId } from "#api/shared/GameId.ts"
import type { OrbitCoordinates } from "#api/shared/OrbitCoordinates.ts"
import { PlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { StarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { ACTION_RULES, ActionDto, ActionTypeSchema } from "#lib/db/gameplay/actions.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import type { Point2D } from "#lib/map-generation/points/Point2D.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"
import { type ActionModel, type GalaxyModel, type GameplayRepository, type PlayerViewModel } from "./gameplay.repository.ts"

const GALAXY_SIZE_LIGHT_YEARS = 100
const REGION_SIZE_LIGHT_YEARS = 10
const GALAXY_ORIGIN = {
  x: GALAXY_SIZE_LIGHT_YEARS / 2,
  y: GALAXY_SIZE_LIGHT_YEARS / 2,
}
const GALAXY_SYSTEMS_COUNT = 1_000

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

      const startingResources = Object.values(ResourceType).map((resourceType) => ({
        resourceType,
        amount: STARTING_RESOURCE_AMOUNTS[resourceType],
      }))
      const playerResources = gameForStart.value.playerIds.flatMap((playerId) =>
        startingResources.map((resource) => ({ playerId, ...resource })),
      )

      const startTime = Timer.start()
      const galaxy = createGalaxy(gameForStart.value.seed)
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      await this.gameplayRepository.startGame(
        {
          game: gameForStart.value,
          status: GameStatus.COLLECTING_ACTIONS,
          startedAt,
          nextTurnAt,
          playerResources,
          galaxy,
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
      const activeGameResult = await this.gameplayRepository.getActionContext({ gameId, playerId }, tx)
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
      const activeGameResult = await this.gameplayRepository.getActionContext({ gameId, playerId }, tx)
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

function createGalaxy(seed: number): GalaxyModel {
  const rng = createRng(mulberry32Prng(seed))
  const generatedGalaxy = galaxyGenerator({
    size: GALAXY_SIZE_LIGHT_YEARS,
    pointsGenerator: () =>
      spiralGenerator({
        origin: GALAXY_ORIGIN,
        radius: GALAXY_SIZE_LIGHT_YEARS / 2,
        nbPoints: GALAXY_SYSTEMS_COUNT,
        rng,
      }),
    rng,
  })

  let nextPlanetId = 1
  return {
    systems: generatedGalaxy.systems.map((system, starIndex) => {
      const starCoordinates = toStarCoordinates(system.star)

      return {
        star: {
          id: starIndex + 1,
          ...system.star,
          coordinates: starCoordinates,
        },
        planets: system.planets.map((planet) => ({
          id: nextPlanetId++,
          ...planet,
          coordinates: `${starCoordinates}:${toOrbitCoordinates({ star: system.star, planet })}`,
        })),
      }
    }),
  }
}

/**
 * Star coordinates go from 00:00 to 99:99
 * The first segment is for the region (<ROW><COL>)
 * The second segment is for the cell in the region (<ROW><COL>)
 */
function toStarCoordinates({ x, y }: Point2D): StarCoordinates {
  const row = Math.floor(y)
  const column = Math.floor(x)
  const regionRow = Math.floor(row / REGION_SIZE_LIGHT_YEARS)
  const regionColumn = Math.floor(column / REGION_SIZE_LIGHT_YEARS)
  const starRow = row % REGION_SIZE_LIGHT_YEARS
  const starColumn = column % REGION_SIZE_LIGHT_YEARS

  return `${regionRow}${regionColumn}:${starRow}${starColumn}`
}

/**
 * Orbit coordinates is the distance in AU to the nearest star, padded with zeroes.
 */
function toOrbitCoordinates({ star, planet }: { star: Point2D; planet: Point2D }): OrbitCoordinates {
  const distanceLightYears = Math.hypot(planet.x - star.x, planet.y - star.y)
  const distanceAu = Distance.convert(Distance.create(distanceLightYears, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)

  return Math.round(distanceAu.value).toString().padStart(2, "0")
}

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  return {
    gameId: playerViewModel.gameId,
    player: playerViewModel.player,
    opponents: playerViewModel.opponents,
    galaxy: {
      systems: playerViewModel.galaxy.systems.map(({ star, planets }) => ({
        star,
        planets: [...planets],
      })),
    },
    turn: playerViewModel.turn,
    nextTurnAt: playerViewModel.nextTurnAt,
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

export type GetPlayerViewDto = z.infer<typeof GetPlayerViewDto>
export const GetPlayerViewDto = z.object({
  gameId: z.coerce.number(),
  playerId: PlayerId,
})

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDto>
export const PlayerViewPlayerDto = z.object({ id: PlayerId, color: z.enum(PlayerColor) })

export const StarDto = z.object({
  id: z.number(),
  name: z.string(),
  coordinates: StarCoordinates,
  x: z.number(),
  y: z.number(),
})

export const PlanetDto = z.object({
  id: z.number(),
  name: z.string(),
  coordinates: PlanetCoordinates,
  x: z.number(),
  y: z.number(),
})

export const GalaxyDto = z.object({
  systems: z.array(
    z.object({
      star: StarDto,
      planets: z.array(PlanetDto),
    }),
  ),
})

export type PlayerViewDto = z.infer<typeof PlayerViewDto>
export const PlayerViewDto = z.object({
  gameId: GameId,
  player: PlayerViewPlayerDto,
  opponents: z.record(PlayerId, PlayerViewPlayerDto),
  galaxy: GalaxyDto,
  turn: z.number(),
  nextTurnAt: z.date(),
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
