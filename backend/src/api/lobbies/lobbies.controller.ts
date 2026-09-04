import { Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GameId } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import { PlayerId } from "#lib/db/players/PlayerId.ts"
import { RulesetId } from "#lib/db/rulesets/RulesetId.ts"
import { couldNot, rollbackOnFailure, TransactionRollbackError } from "#lib/errors.ts"
import { UInt32 } from "#lib/UInt32.ts"
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

    if (createLobbyDto.configuration.mapGenerationSeed !== undefined && !UInt32.validate(createLobbyDto.configuration.mapGenerationSeed)) {
      return Result.Failure(`The seed must be an integer between 0 and ${UInt32.max}`)
    }

    const status = createLobbyDto.configuration.nbSeats <= 1 ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS
    const createLobbyResult = await this.lobbiesRepository.createLobby({
      ...createLobbyDto,
      mapGenerationSeed: createLobbyDto.configuration.mapGenerationSeed ?? UInt32.random(),
      status,
      creatorPlayerColor: PlayerColor.WHITE,
    })
    if (Result.isFailure(createLobbyResult)) {
      return createLobbyResult
    }

    return createLobbyResult
  }

  public async getCreationSettings(): Promise<Result<LobbyCreationSettingsDto, string>> {
    const lobbyCreationSettingsResult = await this.lobbiesRepository.getLobbyCreationSettings()
    if (Result.isFailure(lobbyCreationSettingsResult)) {
      return lobbyCreationSettingsResult
    }

    return Result.Success({
      maxNbSeats: MAX_NB_SEATS,
      ...lobbyCreationSettingsResult.value,
    })
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
    const playerId = branded<PlayerId>(accountId)
    const joinGameResult = await this.createTransaction(async (tx) => {
      const lobbyForJoin = await this.lobbiesRepository.getLobbyForJoin({ gameId }, tx)
      rollbackOnFailure(lobbyForJoin, "Failed to get lobby.")

      if (lobbyForJoin.value.players.find((player) => player.id === playerId) !== undefined) {
        // Already part of the game, return a success for idempotency
        return { playerId }
      }

      if (lobbyForJoin.value.status !== GameStatus.WAITING_FOR_PLAYERS) {
        throw new TransactionRollbackError("Cannot join lobby, it is full.")
      }

      const status =
        lobbyForJoin.value.players.length + 1 >= lobbyForJoin.value.nbSeats ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS

      const usedColors = new Set(lobbyForJoin.value.players.map((player) => player.color))
      const color = Object.values(PlayerColor).find((candidateColor) => !usedColors.has(candidateColor))
      Assert.isDefined(color)

      return await this.lobbiesRepository.joinLobby({ context: lobbyForJoin.value, accountId, color, status }, tx)
    })

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinGameResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameResult
  }

  /**
   * This method is idempotent, leaving an already left game will return a success.
   */
  public async leaveLobby({ gameId, accountId }: LeaveLobbyDto): Promise<Result<LeftLobbyDto, string>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const lobbyForLeave = await this.lobbiesRepository.getLobbyForLeave({ gameId }, tx)
      rollbackOnFailure(lobbyForLeave, "Failed to get lobby.")

      if (!lobbyForLeave.value.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (lobbyForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && lobbyForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("Cannot leave a lobby that has started.")
      }

      if (lobbyForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollbackError("Cannot leave a lobby as its creator.")
      }

      await this.lobbiesRepository.leaveLobby({ context: lobbyForLeave.value, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
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
    (status === GameStatus.COLLECTING_ACTIONS || status === GameStatus.PROCESSING_TURN) &&
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

export type CreateLobbyConfigurationDto = z.infer<typeof CreateLobbyConfigurationDto>
export const CreateLobbyConfigurationDto = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  mapGenerationSeed: z.number().exactOptional(),
  rulesetId: RulesetId,
})

export type CreateLobbyDto = z.infer<typeof CreateLobbyDto>
export const CreateLobbyDto = z.object({
  createdByAccountId: AccountId,
  configuration: CreateLobbyConfigurationDto,
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

export type RulesetSummaryDto = z.infer<typeof RulesetSummaryDto>
const RulesetSummaryDto = z.object({
  id: RulesetId,
  name: z.string(),
  isDefault: z.boolean(),
})

export type LobbyCreationSettingsDto = z.infer<typeof LobbyCreationSettingsDto>
export const LobbyCreationSettingsDto = z.object({
  maxNbSeats: z.number(),
  rulesets: z.array(RulesetSummaryDto).readonly(),
})

export type LobbyPlayerDto = z.infer<typeof LobbyPlayerDto>
export const LobbyPlayerDto = z.object({
  id: PlayerId,
  alias: z.string().nullable(),
  color: z.enum(PlayerColor),
})

export type LobbyConfigurationDto = z.infer<typeof LobbyConfigurationDto>
export const LobbyConfigurationDto = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  ruleset: RulesetSummaryDto,
})

export type LobbyDto = z.infer<typeof LobbyDto>
export const LobbyDto = z.object({
  id: GameId,
  winnerAccountId: AccountId.nullable(),
  configuration: LobbyConfigurationDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: LobbyPlayerDto,
  players: z.array(LobbyPlayerDto).readonly(),
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
