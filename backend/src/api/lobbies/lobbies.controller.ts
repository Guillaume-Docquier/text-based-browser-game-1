import { type Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { AccountId } from "#api/accounts/AccountId.ts"
import { createDefaultStarSystemGenerationSettings } from "#api/gameplay/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { createStarSystemGenerationSettingsLimits } from "#api/gameplay/star-systems/createStarSystemGenerationSettingsLimits.ts"
import { GameId } from "#api/shared/GameId.ts"
import { computeGameStatus, GameStatus } from "#api/shared/GameStatus.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type LobbiesRepository, type LobbyModel } from "./lobbies.repository.ts"

export class LobbiesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({
    logger,
    createTransaction,
    lobbiesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    lobbiesRepository: LobbiesRepository
  }) {
    this.logger = logger.child({ scope: "lobbies-controller" })
    this.createTransaction = createTransaction
    this.lobbiesRepository = lobbiesRepository
  }

  public async createLobby(createLobbyDto: CreateLobbyDto): Promise<Result<CreatedLobbyDto, string>> {
    const starSystemGenerationSettings =
      createLobbyDto.configuration.starSystemGenerationSettings ?? createDefaultStarSystemGenerationSettings()
    const validateSettingsResult = validateStarSystemGenerationSettings(starSystemGenerationSettings)
    if (Result.isFailure(validateSettingsResult)) {
      return validateSettingsResult
    }

    const createLobbyResult = await this.lobbiesRepository.createLobby({
      ...createLobbyDto,
      configuration: {
        ...createLobbyDto.configuration,
        starSystemGenerationSettings,
      },
    })
    if (Result.isFailure(createLobbyResult)) {
      return createLobbyResult
    }

    return createLobbyResult
  }

  public getCreationSettings(): LobbyCreationSettingsDto {
    return {
      defaultStarSystemGenerationSettings: createDefaultStarSystemGenerationSettings(),
      starSystemGenerationSettingsLimits: createStarSystemGenerationSettingsLimits(),
    }
  }

  public async getLobbyById({ gameId, playerId }: { gameId: GameId; playerId: PlayerId | undefined }): Promise<LobbyDto | undefined> {
    const lobbyResult = await this.lobbiesRepository.getLobbyById({ gameId })
    if (Result.isFailure(lobbyResult)) {
      this.logger.error("Could not get game lobby, returning undefined", { gameId, playerId, error: lobbyResult.error })
      return undefined
    }

    const lobbyModel = lobbyResult.value
    if (lobbyModel === undefined) {
      return undefined
    }

    return toLobbyDto({ lobbyModel, playerId })
  }

  public async joinLobby({ gameId, accountId }: JoinLobbyDto): Promise<Result<JoinedLobbyDto, string>> {
    const joinGameResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const lobbyModelResult = await this.lobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(lobbyModelResult, "Failed to get game lobby")

        const lobbyModel = lobbyModelResult.value
        if (lobbyModel === undefined) {
          throw new TransactionRollback("Cannot join game lobby, it could not be found")
        }

        if (!toLobbyDto({ lobbyModel, playerId: accountId }).canJoin) {
          throw new TransactionRollback("Cannot join game lobby, this player is not allowed to join it at the moment")
        }

        const joinResult = await this.lobbiesRepository.joinLobby({ gameId, accountId }, tx)
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
        const lobbyResult = await this.lobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(lobbyResult, "Failed to get game lobby")

        const lobbyModel = lobbyResult.value
        if (lobbyModel === undefined) {
          throw new TransactionRollback("Cannot leave game lobby, it could not be found")
        }

        if (!toLobbyDto({ lobbyModel, playerId: accountId }).canLeave) {
          throw new TransactionRollback("Cannot leave game lobby, this player is not allowed to leave it at the moment")
        }

        const leaveResult = await this.lobbiesRepository.leaveLobby({ gameId, accountId }, tx)
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

export function toLobbyDto({ lobbyModel, playerId }: { lobbyModel: LobbyModel; playerId: PlayerId | undefined }): LobbyDto {
  const status = computeGameStatus({
    nbPlayers: lobbyModel.players.length,
    nbSeats: lobbyModel.configuration.nbSeats,
    startedAt: lobbyModel.startedAt,
    endedAt: lobbyModel.endedAt,
  })

  const canJoin =
    playerId !== undefined && status === GameStatus.WAITING_FOR_PLAYERS && lobbyModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id !== playerId &&
    lobbyModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id === playerId

  return {
    ...lobbyModel,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
export const StarSystemGenerationSettingsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: z.number(),
})

export type CreateLobbyDto = z.infer<typeof CreateLobbyDto>
export const CreateLobbyDto = z.object({
  createdByAccountId: AccountId,
  configuration: z.object({
    name: z.string(),
    nbSeats: z.number(),
    tickIntervalSeconds: z.number(),
    starSystemGenerationSettings: StarSystemGenerationSettingsDto.optional(),
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

export type StarSystemGenerationSettingsLimitsDto = z.infer<typeof StarSystemGenerationSettingsLimitsDto>
export const StarSystemGenerationSettingsLimitsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: RangeDto,
})

export type LobbyCreationSettingsDto = z.infer<typeof LobbyCreationSettingsDto>
export const LobbyCreationSettingsDto = z.object({
  defaultStarSystemGenerationSettings: StarSystemGenerationSettingsDto,
  starSystemGenerationSettingsLimits: StarSystemGenerationSettingsLimitsDto,
})

export type GameConfigurationDto = z.infer<typeof GameConfigurationDto>
export const GameConfigurationDto = z.object({
  name: z.string(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
})

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

const STAR_SYSTEM_RANGE_SETTING_KEYS = [
  "planetDensity",
  "nbPlanets",
  "nbMoonsPerPlanet",
  "nbAsteroidBelts",
  "nbAsteroidsPerSector",
] as const satisfies ReadonlyArray<keyof Omit<StarSystemGenerationSettingsDto, "seed">>

function validateStarSystemGenerationSettings(settings: StarSystemGenerationSettingsDto): Result<true, string> {
  const limits = createStarSystemGenerationSettingsLimits()

  for (const key of STAR_SYSTEM_RANGE_SETTING_KEYS) {
    const range = settings[key]
    const validRangeResult = Range.safeCreate(range)
    if (Result.isFailure(validRangeResult)) {
      return Result.Failure(`Invalid ${key}: ${validRangeResult.error}`)
    }

    const limit = limits[key]
    if (range.numericType !== limit.numericType || range.maxBoundType !== limit.maxBoundType || !Range.isWithin(limit, range)) {
      return Result.Failure(`${key} must be within the accepted limits`)
    }
  }

  if (!Number.isInteger(settings.seed) || !Range.isWithin(limits.seed, settings.seed)) {
    return Result.Failure("seed must be within the accepted limits")
  }

  return Result.Success(true)
}
