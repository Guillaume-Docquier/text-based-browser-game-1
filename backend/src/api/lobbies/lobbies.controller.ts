import { Assert, type Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { createStarSystemGenerationSettingsDefaults } from "#api/gameplay/star-systems/createStarSystemGenerationSettingsDefaults.ts"
import { StarSystemGenerationSettingsLimits } from "#api/gameplay/star-systems/StarSystemGenerationSettingsLimits.ts"
import { GameId } from "#api/shared/GameId.ts"
import { PlayerId } from "#api/shared/PlayerId.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { type LobbiesRepository, type LobbyModel } from "./lobbies.repository.ts"

export const MAX_NB_SEATS = 16

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
    if (createLobbyDto.configuration.nbSeats > MAX_NB_SEATS) {
      return Result.Failure(`Games cannot have more than ${MAX_NB_SEATS} seats`)
    }

    if (!validateStarSystemGenerationSettings(createLobbyDto.configuration.starSystemGenerationSettings)) {
      return Result.Failure("Star System generation settings must be within the accepted limits")
    }

    const status = createLobbyDto.configuration.nbSeats <= 1 ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS
    const createLobbyResult = await this.lobbiesRepository.createLobby({
      ...createLobbyDto,
      status,
      creatorPlayerColor: PlayerColor.WHITE,
    })
    if (Result.isFailure(createLobbyResult)) {
      return createLobbyResult
    }

    return createLobbyResult
  }

  public getCreationSettings(): LobbyCreationSettingsDto {
    return {
      maxNbSeats: MAX_NB_SEATS,
      defaultStarSystemGenerationSettings: createStarSystemGenerationSettingsDefaults(),
      starSystemGenerationSettingsLimits: StarSystemGenerationSettingsLimits,
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

  /**
   * This method is idempotent, joining an already joined game will return a success.
   */
  public async joinLobby({ gameId, accountId }: JoinLobbyDto): Promise<Result<JoinedLobbyDto, string>> {
    const joinGameResult = await this.createTransaction(async (tx) => {
      const lobbyForJoin = await this.lobbiesRepository.getLobbyForJoin({ gameId }, tx)
      rollbackOnFailure(lobbyForJoin, "Failed to get lobby.")

      if (lobbyForJoin.value.players.find((player) => player.id === accountId) !== undefined) {
        // Already part of the game, return a success for idempotency
        return { playerId: accountId }
      }

      if (lobbyForJoin.value.status !== GameStatus.WAITING_FOR_PLAYERS) {
        throw new TransactionRollback("Cannot join lobby, it is full.")
      }

      const status =
        lobbyForJoin.value.players.length + 1 >= lobbyForJoin.value.nbSeats ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS

      const usedColors = new Set(lobbyForJoin.value.players.map((player) => player.color))
      const color = Object.values(PlayerColor).find((candidateColor) => !usedColors.has(candidateColor))
      Assert.isDefined(color)

      return await this.lobbiesRepository.joinLobby({ lobby: lobbyForJoin.value, accountId, color, status }, tx)
    })

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, playerId: accountId, error: joinGameResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameResult
  }

  /**
   * This method is idempotent, leaving an already left game will return a success.
   */
  public async leaveLobby({ gameId, accountId }: LeaveLobbyDto): Promise<Result<LeftLobbyDto, string>> {
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const lobbyForLeave = await this.lobbiesRepository.getLobbyForLeave({ gameId }, tx)
      rollbackOnFailure(lobbyForLeave, "Failed to get lobby.")

      if (!lobbyForLeave.value.playerIds.includes(accountId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (lobbyForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && lobbyForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollback("Cannot leave a lobby that has started.")
      }

      if (lobbyForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollback("Cannot leave a lobby as its creator.")
      }

      await this.lobbiesRepository.leaveLobby({ lobby: lobbyForLeave.value, accountId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(true)
  }
}

export function toLobbyDto({ lobbyModel, playerId }: { lobbyModel: LobbyModel; playerId: PlayerId | undefined }): LobbyDto {
  const status = lobbyModel.status

  const canJoin =
    playerId !== undefined && status === GameStatus.WAITING_FOR_PLAYERS && lobbyModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id !== playerId &&
    lobbyModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    lobbyModel.creator.id === playerId

  const canOpen =
    playerId !== undefined &&
    (status === GameStatus.COLLECTING_ORDERS || status === GameStatus.PROCESSING_TURN) &&
    lobbyModel.players.some((player) => player.id === playerId)

  return {
    ...lobbyModel,
    status,
    canJoin,
    canLeave,
    canStart,
    canOpen,
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
    turnIntervalSeconds: z.number(),
    starSystemGenerationSettings: StarSystemGenerationSettingsDto,
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
  nbPlanets: RangeDto,
  planetDensity: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: RangeDto,
})

export type LobbyCreationSettingsDto = z.infer<typeof LobbyCreationSettingsDto>
export const LobbyCreationSettingsDto = z.object({
  maxNbSeats: z.number(),
  defaultStarSystemGenerationSettings: StarSystemGenerationSettingsDto,
  starSystemGenerationSettingsLimits: StarSystemGenerationSettingsLimitsDto,
})

export type GameConfigurationDto = z.infer<typeof GameConfigurationDto>
export const GameConfigurationDto = z.object({
  name: z.string(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
})

export type LobbyPlayerDto = z.infer<typeof LobbyPlayerDto>
export const LobbyPlayerDto = z.object({
  id: PlayerId,
  alias: z.string().nullable(),
  color: z.enum(PlayerColor),
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
  /**
   * Whether the current player can open the started game.
   */
  canOpen: z.boolean(),
})

function isRangeWithinLimit(range: Range, limit: Range): boolean {
  return range.numericType === limit.numericType && Range.isWithin(limit, range)
}

function validateStarSystemGenerationSettings(settings: StarSystemGenerationSettingsDto): boolean {
  const limits = StarSystemGenerationSettingsLimits

  return (
    isRangeWithinLimit(settings.planetDensity, limits.planetDensity) &&
    isRangeWithinLimit(settings.nbPlanets, limits.nbPlanets) &&
    isRangeWithinLimit(settings.nbMoonsPerPlanet, limits.nbMoonsPerPlanet) &&
    isRangeWithinLimit(settings.nbAsteroidBelts, limits.nbAsteroidBelts) &&
    isRangeWithinLimit(settings.nbAsteroidsPerSector, limits.nbAsteroidsPerSector) &&
    Number.isInteger(settings.seed) &&
    Range.isWithin(limits.seed, settings.seed)
  )
}
