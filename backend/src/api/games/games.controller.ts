import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryModel, GamesRepository } from "#lib/db/games/games.repository.ts"
import type { GamePlayersRepository } from "#lib/db/games/gamePlayers.repository.ts"
import type { GameSettingsRepository } from "#lib/db/games/gameSettings.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { couldNot, TransactionRollback } from "#lib/errors.ts"
import { RangeDto } from "#api/RangeDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { computeNextTickDate } from "#tick-processing/processTick.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/gameResources.ts"
import z from "zod"
import { PlayerId } from "#api/games/PlayerId.ts"
import { AccountId } from "#api/accounts/AccountId.ts"
import { GameId } from "#api/games/GameId.ts"

export class GamesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gamesRepository: GamesRepository
  private readonly gameSettingsRepository: GameSettingsRepository
  private readonly gamePlayersRepository: GamePlayersRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gameTicksRepository: GameTicksRepository
  private readonly gamePlayerResourcesRepository: GamePlayerResourcesRepository

  public constructor({
    logger,
    createTransaction,
    gamesRepository,
    gameSettingsRepository,
    gamePlayersRepository,
    gameStatesRepository,
    gameTicksRepository,
    gamePlayerResourcesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gamesRepository: GamesRepository
    gameSettingsRepository: GameSettingsRepository
    gamePlayersRepository: GamePlayersRepository
    gameStatesRepository: GameStatesRepository
    gameTicksRepository: GameTicksRepository
    gamePlayerResourcesRepository: GamePlayerResourcesRepository
  }) {
    this.logger = logger.child({ scope: "games-controller" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
    this.gameSettingsRepository = gameSettingsRepository
    this.gamePlayersRepository = gamePlayersRepository
    this.gameStatesRepository = gameStatesRepository
    this.gameTicksRepository = gameTicksRepository
    this.gamePlayerResourcesRepository = gamePlayerResourcesRepository
  }

  public async createGame(newGame: NewGameDto): Promise<Result<CreatedGameDto, string>> {
    const createGameResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const gameResult = await this.gamesRepository.createGame({ createdByAccountId: newGame.createdByAccountId }, tx)
        if (Result.isFailure(gameResult)) {
          throw new TransactionRollback("Failed to create game")
        }

        const game = gameResult.value
        const gameSettingsResult = await this.gameSettingsRepository.create(
          {
            ...newGame.settings,
            gameId: game.id,
            starSystemGenerationSettings: createDefaultStarSystemGenerationSettings(),
          },
          tx,
        )
        if (Result.isFailure(gameSettingsResult)) {
          throw new TransactionRollback("Failed to create game settings")
        }

        const joinGameResult = await this.gamePlayersRepository.createPlayer({ gameId: game.id, playerId: game.createdByAccountId }, tx)
        if (Result.isFailure(joinGameResult)) {
          throw new TransactionRollback("Failed to join game after creating it")
        }

        return {
          ...game,
          settings: gameSettingsResult.value,
        }
      }),
    )

    if (Result.isFailure(createGameResult)) {
      this.logger.error("Could not create game", { newGame, error: createGameResult.error })
      return Result.Failure(couldNot("create game"))
    }

    return createGameResult
  }

  public async getGameSummaries({ playerId }: { playerId: PlayerId | undefined }): Promise<GameSummaryDto[]> {
    const getSummariesResult = await this.gamesRepository.getGameSummaries()
    if (Result.isFailure(getSummariesResult)) {
      this.logger.error("Could not get game summaries, returning empty array", { playerId, error: getSummariesResult.error })
      return []
    }

    return getSummariesResult.value.map((gameSummaryModel) => toGameSummaryDto({ gameSummaryModel, playerId }))
  }

  public async getGameSummaryById({
    gameId,
    playerId,
  }: {
    gameId: GameId
    playerId: PlayerId | undefined
  }): Promise<GameSummaryDto | undefined> {
    const getSummaryResult = await this.gamesRepository.getGameSummaryById({ gameId })
    if (Result.isFailure(getSummaryResult)) {
      this.logger.error("Could not get game summary, returning undefined", { gameId, playerId, error: getSummaryResult.error })
      return undefined
    }

    const gameSummaryModel = getSummaryResult.value
    if (gameSummaryModel === undefined) {
      return undefined
    }

    return toGameSummaryDto({ gameSummaryModel, playerId })
  }

  public async joinGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<GameSummaryDto, string>> {
    const gameJoinResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameSummaryResult = await this.gamesRepository.getGameSummaryById({ gameId }, tx)
        if (Result.isFailure(gameSummaryResult)) {
          throw new TransactionRollback("Failed to get game summary")
        }

        const gameSummaryModel = gameSummaryResult.value
        if (gameSummaryModel === undefined) {
          throw new TransactionRollback("Cannot join game, the game could not be found")
        }

        if (!toGameSummaryDto({ gameSummaryModel, playerId }).canJoin) {
          throw new TransactionRollback("Cannot join game, this player cannot join the game at the moment")
        }

        const joinResult = await this.gamePlayersRepository.createPlayer({ gameId, playerId }, tx)
        if (Result.isFailure(joinResult)) {
          throw new TransactionRollback("Failed to join game")
        }
      }),
    )

    if (Result.isFailure(gameJoinResult)) {
      this.logger.error("Could not join game", { gameId, playerId, error: gameJoinResult.error })
      return Result.Failure(couldNot("join game"))
    }

    const gameSummary = await this.getGameSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async leaveGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<GameSummaryDto, string>> {
    const gameLeaveResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameSummaryResult = await this.gamesRepository.getGameSummaryById({ gameId }, tx)
        if (Result.isFailure(gameSummaryResult)) {
          throw new TransactionRollback("Failed to get game")
        }

        const gameSummaryModel = gameSummaryResult.value
        if (gameSummaryModel === undefined) {
          throw new TransactionRollback("Cannot leave game, the game could not be found")
        }

        if (!toGameSummaryDto({ gameSummaryModel, playerId }).canLeave) {
          throw new TransactionRollback("Cannot leave game, this player cannot leave the game at the moment")
        }

        const leaveResult = await this.gamePlayersRepository.delete({ gameId, playerId }, tx)
        if (Result.isFailure(leaveResult)) {
          throw new TransactionRollback("Failed to leave game")
        }
      }),
    )

    if (Result.isFailure(gameLeaveResult)) {
      this.logger.error("Could not leave game", { gameId, playerId, error: gameLeaveResult.error })
      return Result.Failure(couldNot("leave game"))
    }

    const gameSummary = await this.getGameSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async startGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<GameSummaryDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameSummaryResult = await this.gamesRepository.getGameSummaryById({ gameId }, tx)
        if (Result.isFailure(gameSummaryResult)) {
          throw new TransactionRollback("Failed to get game")
        }

        const gameSummaryModel = gameSummaryResult.value
        if (gameSummaryModel === undefined) {
          throw new TransactionRollback("Cannot start game, the game could not be found")
        }

        if (!toGameSummaryDto({ gameSummaryModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, the game is not joinable by this player")
        }

        const startedAt = new Date()
        const startGameResult = await this.gamesRepository.updateGame({ gameId }, { startedAt }, tx)
        if (Result.isFailure(startGameResult)) {
          throw new TransactionRollback("Failed to update game start date")
        }

        const lockSettingsResult = await this.gameSettingsRepository.update({ gameId }, { locked: true }, tx)
        if (Result.isFailure(lockSettingsResult)) {
          throw new TransactionRollback("Failed to lock game settings")
        }

        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: gameSummaryModel.settings.tickIntervalSeconds })
        const gameStateResult = await this.gameStatesRepository.create({ gameId, nextTickAt }, tx)
        if (Result.isFailure(gameStateResult)) {
          throw new TransactionRollback("Failed to create initial game state")
        }

        const playerIdsResult = await this.gamePlayersRepository.getPlayerIds({ gameId }, tx)
        if (Result.isFailure(playerIdsResult)) {
          throw new TransactionRollback("Failed to get player ids to setup initial resources")
        }

        const createStartingResourcesResult = await this.gamePlayerResourcesRepository.createMany(
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
        if (Result.isFailure(createStartingResourcesResult)) {
          throw new TransactionRollback("Failed to create initial resources")
        }

        const gameTickResult = await this.gameTicksRepository.create(
          { gameId, tick: gameStateResult.value.tick, scheduledFor: gameStateResult.value.nextTickAt },
          tx,
        )
        if (Result.isFailure(gameTickResult)) {
          throw new TransactionRollback("Failed to schedule first game tick")
        }
      }),
    )

    if (Result.isFailure(gameStartResult)) {
      this.logger.error("Could not start game", { gameId, playerId, error: gameStartResult.error })
      return Result.Failure(couldNot("start game"))
    }

    const gameSummary = await this.getGameSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }
}

function toGameSummaryDto({
  gameSummaryModel,
  playerId,
}: {
  gameSummaryModel: GameSummaryModel
  playerId: PlayerId | undefined
}): GameSummaryDto {
  // prettier-ignore
  const status =
    gameSummaryModel.endedAt !== null ? GameSummaryStatus.ENDED
    : gameSummaryModel.startedAt !== null ? GameSummaryStatus.STARTED
    : gameSummaryModel.players.length >= gameSummaryModel.settings.nbSeats ? GameSummaryStatus.READY_TO_START
    : GameSummaryStatus.WAITING_FOR_PLAYERS

  const canJoin =
    playerId !== undefined &&
    status === GameSummaryStatus.WAITING_FOR_PLAYERS &&
    gameSummaryModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryModel.creator.id !== playerId &&
    gameSummaryModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryModel.creator.id === playerId

  return {
    ...gameSummaryModel,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

export type NewGameDto = z.infer<typeof NewGameDto>
export const NewGameDto = z.object({
  createdByAccountId: AccountId,
  settings: z.object({
    name: z.string(),
    nbSeats: z.number(),
    tickIntervalSeconds: z.number(),
  }),
})

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
export const StarSystemGenerationSettingsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: z.number(),
})

export type GameSettingsDto = z.infer<typeof GameSettingsDto>
export const GameSettingsDto = z.object({
  name: z.string(),
  locked: z.boolean(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
})

export type CreatedGameDto = z.infer<typeof CreatedGameDto>
export const CreatedGameDto = z.object({
  id: GameId,
  createdByAccountId: AccountId,
  winnerAccountId: AccountId.nullable(),
  settings: GameSettingsDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})

export const GameSummaryStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  STARTED: "STARTED",
  ENDED: "ENDED",
} as const

export type GameSummaryPlayerDto = z.infer<typeof GameSummaryPlayerDto>
export const GameSummaryPlayerDto = z.object({
  id: PlayerId,
  alias: z.string().nullable(),
})

export type GameSummaryDto = z.infer<typeof GameSummaryDto>
export const GameSummaryDto = z.object({
  id: GameId,
  winnerAccountId: AccountId.nullable(),
  settings: GameSettingsDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameSummaryPlayerDto,
  players: z.array(GameSummaryPlayerDto),
  status: z.enum(GameSummaryStatus),
  /**
   * Whether the current player can join the game.
   */
  canJoin: z.boolean(),
  /**
   * Whether the current player can leave the game.
   */
  canLeave: z.boolean(),
  /**
   * Whether the current player can start the game.
   */
  canStart: z.boolean(),
})
