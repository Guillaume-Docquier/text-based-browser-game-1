import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { AccountId } from "#api/accounts/AccountId.ts"
import { GameId } from "#api/games/GameId.ts"
import { PlayerId } from "#api/games/PlayerId.ts"
import { RangeDto } from "#api/RangeDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { type GameLobbiesRepository, type LobbyModel } from "./gameLobbies.repository.ts"

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
    this.logger = logger.child({ scope: "lobbies-controller" })
    this.createTransaction = createTransaction
    this.gameLobbiesRepository = gameLobbiesRepository
  }

  public async createLobby(newGame: CreateLobbyDto): Promise<Result<CreatedLobbyDto, string>> {
    const createGameResult = await this.gameLobbiesRepository.createLobby({
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

  public async getLobbyById({ gameId, playerId }: { gameId: GameId; playerId: PlayerId | undefined }): Promise<LobbyDto | undefined> {
    const gameLobbyResult = await this.gameLobbiesRepository.getLobbyById({ gameId })
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

  public async joinLobby({ gameId, accountId }: JoinLobbyDto): Promise<Result<JoinedLobbyDto, string>> {
    const joinGameResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const gameLobbyModelResult = await this.gameLobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyModelResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyModelResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot join game lobby, it could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId: accountId }).canJoin) {
          throw new TransactionRollback("Cannot join game lobby, this player is not allowed to join it at the moment")
        }

        const joinResult = await this.gameLobbiesRepository.joinLobby({ gameId, accountId }, tx)
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

  public async leaveLobby({ gameId, accountId }: LeaveLobbyDto): Promise<Result<LeftLobbyDto, string>> {
    const leaveGameResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameLobbyResult = await this.gameLobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot leave game lobby, it could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId: accountId }).canLeave) {
          throw new TransactionRollback("Cannot leave game lobby, this player is not allowed to leave it at the moment")
        }

        const leaveResult = await this.gameLobbiesRepository.leaveLobby({ gameId, accountId }, tx)
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

export function toGameLobbyDto({ gameLobbyModel, playerId }: { gameLobbyModel: LobbyModel; playerId: PlayerId | undefined }): LobbyDto {
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

export type CreateLobbyDto = z.infer<typeof CreateLobbyDto>
export const CreateLobbyDto = z.object({
  createdByAccountId: AccountId,
  configuration: z.object({
    name: z.string(),
    nbSeats: z.number(),
    tickIntervalSeconds: z.number(),
  }),
})

export type CreatedLobbyDto = z.infer<typeof CreatedLobbyDto>
export const CreatedLobbyDto = z.object({
  createdGameId: GameId,
})

export type JoinLobbyDto = z.infer<typeof JoinLobbyDto>
export const JoinLobbyDto = z.object({
  gameId: GameId,
  accountId: AccountId,
})

export type JoinedLobbyDto = z.infer<typeof JoinedLobbyDto>
export const JoinedLobbyDto = z.object({
  playerId: PlayerId,
})

export type LeaveLobbyDto = z.infer<typeof LeaveLobbyDto>
export const LeaveLobbyDto = z.object({
  gameId: GameId,
  accountId: AccountId,
})

export type LeftLobbyDto = z.infer<typeof LeftLobbyDto>
export const LeftLobbyDto = z.literal(true)

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

export type LobbyPlayerDto = z.infer<typeof LobbyPlayerDto>
export const LobbyPlayerDto = z.object({
  id: PlayerId,
  alias: z.string().nullable(),
})

export type LobbyDto = z.infer<typeof LobbyDto>
export const LobbyDto = z.object({
  id: GameId,
  winnerAccountId: AccountId.nullable(),
  configuration: GameConfigurationDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: LobbyPlayerDto,
  players: z.array(LobbyPlayerDto),
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
