import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { AccountId } from "#api/accounts/AccountId.ts"
import { GameId } from "#api/games/GameId.ts"
import { PlayerId } from "#api/games/PlayerId.ts"
import { RangeDto } from "#api/RangeDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { type GameLobbiesRepository, type GameLobbyModel } from "./gameLobbies.repository.ts"

export class GameLobbiesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gameLobbiesRepository: GameLobbiesRepository

  public constructor({
    logger,
    createTransaction,
    gameLobbiesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gameLobbiesRepository: GameLobbiesRepository
  }) {
    this.logger = logger.child({ scope: "game-lobbies-controller" })
    this.createTransaction = createTransaction
    this.gameLobbiesRepository = gameLobbiesRepository
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
}

export function toGameLobbyDto({
  gameLobbyModel,
  playerId,
}: {
  gameLobbyModel: GameLobbyModel
  playerId: PlayerId | undefined
}): GameLobbyDto {
  // oxfmt-ignore
  const status =
    gameLobbyModel.endedAt !== null ? GameLobbyStatus.ENDED
    : gameLobbyModel.startedAt !== null ? GameLobbyStatus.STARTED
    : gameLobbyModel.players.length >= gameLobbyModel.configuration.nbSeats ? GameLobbyStatus.READY_TO_START
    : GameLobbyStatus.WAITING_FOR_PLAYERS

  const canJoin =
    playerId !== undefined &&
    status === GameLobbyStatus.WAITING_FOR_PLAYERS &&
    gameLobbyModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameLobbyStatus.WAITING_FOR_PLAYERS || status === GameLobbyStatus.READY_TO_START) &&
    gameLobbyModel.creator.id !== playerId &&
    gameLobbyModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameLobbyStatus.WAITING_FOR_PLAYERS || status === GameLobbyStatus.READY_TO_START) &&
    gameLobbyModel.creator.id === playerId

  return {
    ...gameLobbyModel,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

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

export const GameLobbyStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  STARTED: "STARTED",
  ENDED: "ENDED",
} as const

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
  status: z.enum(GameLobbyStatus),
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
