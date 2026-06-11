import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { AccountId } from "#api/accounts/AccountId.ts"
import type { GameListingsRepository } from "#api/game-listings/gameListings.repository.ts"
import { type GameLobbiesRepository, type GameLobbyModel } from "#api/game-lobbies/gameLobbies.repository.ts"
import { GameId } from "#api/games/GameId.ts"
import { PlayerId } from "#api/games/PlayerId.ts"
import { computeGameStatus, GameStatus } from "#api/shared/GameStatus.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/gameResources.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { computeNextTickDate } from "#tick-processing/processTick.ts"

export class GamesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gamesRepository: GamesRepository
  private readonly gameLobbiesRepository: GameLobbiesRepository
  private readonly gameListingsRepository: GameListingsRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gameTicksRepository: GameTicksRepository
  private readonly gamePlayerResourcesRepository: GamePlayerResourcesRepository

  public constructor({
    logger,
    createTransaction,
    gamesRepository,
    gameLobbiesRepository,
    gameListingsRepository,
    gameStatesRepository,
    gameTicksRepository,
    gamePlayerResourcesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gamesRepository: GamesRepository
    gameLobbiesRepository: GameLobbiesRepository
    gameListingsRepository: GameListingsRepository
    gameStatesRepository: GameStatesRepository
    gameTicksRepository: GameTicksRepository
    gamePlayerResourcesRepository: GamePlayerResourcesRepository
  }) {
    this.logger = logger.child({ scope: "games-controller" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
    this.gameLobbiesRepository = gameLobbiesRepository
    this.gameListingsRepository = gameListingsRepository
    this.gameStatesRepository = gameStatesRepository
    this.gameTicksRepository = gameTicksRepository
    this.gamePlayerResourcesRepository = gamePlayerResourcesRepository
  }

  public async createGame(newGame: CreateGameDto): Promise<Result<CreatedGameDto, string>> {
    const createGameResult = await this.gameLobbiesRepository.createGameLobby({
      createdByAccountId: newGame.createdByAccountId,
      configuration: {
        ...newGame.configuration,
        starSystemGenerationSettings: createDefaultStarSystemGenerationSettings(),
      },
    })
    if (Result.isFailure(createGameResult)) {
      return createGameResult
    }

    return createGameResult
  }

  /**
   * Gets ALL the game listings. This only makes sense until we have real traffic.
   */
  public async getListings(): Promise<ListingDto[]> {
    const gameListingsResult = await this.gameListingsRepository.getListings()
    if (Result.isFailure(gameListingsResult)) {
      this.logger.error("Could not get game listings, returning empty array")
      return []
    }

    return gameListingsResult.value
  }

  public async getGameLobbyById({
    gameId,
    playerId,
  }: {
    gameId: GameId
    playerId: PlayerId | undefined
  }): Promise<GameLobbyDto | undefined> {
    const gameLobbyResult = await this.gameLobbiesRepository.getGameLobbyById({ gameId })
    if (Result.isFailure(gameLobbyResult)) {
      this.logger.error("Could not get game summary, returning undefined", { gameId, playerId, error: gameLobbyResult.error })
      return undefined
    }

    const gameLobbyModel = gameLobbyResult.value
    if (gameLobbyModel === undefined) {
      return undefined
    }

    return toGameLobbyDto({ gameLobbyModel, playerId })
  }

  public async joinGameLobby({ gameId, accountId }: JoinGameDto): Promise<Result<JoinedGameDto, string>> {
    const joinGameResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const gameLobbyModelResult = await this.gameLobbiesRepository.getGameLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyModelResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyModelResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot join game lobby, it could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId: accountId }).canJoin) {
          throw new TransactionRollback("Cannot join game lobby, this player is not allowed to join it at the moment")
        }

        const joinResult = await this.gameLobbiesRepository.joinGameLobby({ gameId, accountId }, tx)
        rollbackOnFailure(joinResult, "Failed to join game")

        return joinResult.value
      }),
    )

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, playerId: accountId, error: joinGameResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameResult
  }

  public async leaveGameLobby({ gameId, accountId }: LeaveGameDto): Promise<Result<LeftGameDto, string>> {
    const leaveGameResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameLobbyResult = await this.gameLobbiesRepository.getGameLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot leave game lobby, it could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId: accountId }).canLeave) {
          throw new TransactionRollback("Cannot leave game lobby, this player is not allowed to leave it at the moment")
        }

        const leaveResult = await this.gameLobbiesRepository.leaveGameLobby({ gameId, accountId }, tx)
        rollbackOnFailure(leaveResult, "Failed to leave game lobby")
      }),
    )

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(true)
  }

  public async startGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<GameLobbyDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameLobbyResult = await this.gameLobbiesRepository.getGameLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot start game, the lobby could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = new Date()
        const startGameResult = await this.gamesRepository.updateGame({ gameId }, { startedAt }, tx)
        rollbackOnFailure(startGameResult, "Failed to update game start date")

        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: gameLobbyModel.configuration.tickIntervalSeconds })
        const gameStateResult = await this.gameStatesRepository.create({ gameId, nextTickAt }, tx)
        rollbackOnFailure(gameStateResult, "Failed to create initial game state")

        const playerIdsResult = await this.gamesRepository.getPlayerIds({ gameId }, tx)
        rollbackOnFailure(playerIdsResult, "Failed to get player ids to setup initial resources")

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
        rollbackOnFailure(createStartingResourcesResult, "Failed to create initial resources")

        const gameTickResult = await this.gameTicksRepository.create(
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

    const gameSummary = await this.getGameLobbyById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }
}

function toGameLobbyDto({ gameLobbyModel, playerId }: { gameLobbyModel: GameLobbyModel; playerId: PlayerId | undefined }): GameLobbyDto {
  const status = computeGameStatus({
    nbPlayers: gameLobbyModel.players.length,
    nbSeats: gameLobbyModel.configuration.nbSeats,
    startedAt: gameLobbyModel.startedAt,
    endedAt: gameLobbyModel.endedAt,
  })

  const canJoin =
    playerId !== undefined && status === GameStatus.WAITING_FOR_PLAYERS && gameLobbyModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    gameLobbyModel.creator.id !== playerId &&
    gameLobbyModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    gameLobbyModel.creator.id === playerId

  return {
    ...gameLobbyModel,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

export type ListingDto = z.infer<typeof ListingDto>
export const ListingDto = z.object({
  id: GameId,
  name: z.string(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: z.enum(GameStatus),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})

export type CreateGameDto = z.infer<typeof CreateGameDto>
export const CreateGameDto = z.object({
  createdByAccountId: AccountId,
  configuration: z.object({
    name: z.string(),
    nbSeats: z.number(),
    tickIntervalSeconds: z.number(),
  }),
})

export type CreatedGameDto = z.infer<typeof CreatedGameDto>
export const CreatedGameDto = z.object({
  createdGameId: GameId,
})

export type JoinGameDto = z.infer<typeof JoinGameDto>
export const JoinGameDto = z.object({
  gameId: GameId,
  accountId: AccountId,
})

export type JoinedGameDto = z.infer<typeof JoinedGameDto>
export const JoinedGameDto = z.object({
  playerId: PlayerId,
})

export type LeaveGameDto = z.infer<typeof LeaveGameDto>
export const LeaveGameDto = z.object({
  gameId: GameId,
  accountId: AccountId,
})

export type LeftGameDto = z.infer<typeof LeftGameDto>
export const LeftGameDto = z.literal(true)

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
export const StarSystemGenerationSettingsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: z.number(),
})

export type GameConfigurationDto = z.infer<typeof GameConfigurationDto>
export const GameConfigurationDto = z.object({
  name: z.string(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
})

export type GameLobbyPlayerDto = z.infer<typeof GameLobbyPlayerDto>
export const GameLobbyPlayerDto = z.object({
  id: PlayerId,
  alias: z.string().nullable(),
})

export type GameLobbyDto = z.infer<typeof GameLobbyDto>
export const GameLobbyDto = z.object({
  id: GameId,
  winnerAccountId: AccountId.nullable(),
  configuration: GameConfigurationDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameLobbyPlayerDto,
  players: z.array(GameLobbyPlayerDto),
  status: z.enum(GameStatus),
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
